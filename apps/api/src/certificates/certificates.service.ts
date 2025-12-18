import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CertificatesService {
  private readonly storagePath: string;

  constructor(private prisma: PrismaService) {
    this.storagePath = path.join(process.cwd(), 'storage', 'certificates');
    // Ensure storage directory exists
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  // ============================================
  // ALUNO: Emitir certificado
  // ============================================

  async issueCertificate(userId: string, courseId: string, ipAddress?: string) {
    // Check if certificate already exists
    const existingCert = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    });

    if (existingCert) {
      // Return existing certificate instead of creating new
      return {
        certificate: existingCert,
        downloadUrl: `/certificates/download/${existingCert.code}`,
        message: 'Certificado já emitido anteriormente',
      };
    }

    // Get user and course data
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        cpf: true,
        instituteId: true,
        institute: { select: { name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: { select: { id: true } },
          },
        },
      },
    });

    if (!course || course.instituteId !== user.instituteId) {
      throw new NotFoundException('Curso não encontrado');
    }

    // Get all lesson IDs
    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));

    if (lessonIds.length === 0) {
      throw new BadRequestException('Curso não possui aulas');
    }

    // Check if user completed all lessons
    const approvals = await this.prisma.lessonApproval.findMany({
      where: {
        userId,
        lessonId: { in: lessonIds },
      },
    });

    if (approvals.length !== lessonIds.length) {
      throw new BadRequestException(
        `Você ainda não concluiu todas as aulas do curso. Concluídas: ${approvals.length}/${lessonIds.length}`,
      );
    }

    // Generate unique code
    const code = this.generateCode();

    // Create certificate record
    const certificate = await this.prisma.certificate.create({
      data: {
        code,
        instituteId: user.instituteId,
        userId,
        courseId,
        metadata: {
          userName: user.name,
          userCpf: this.maskCpf(user.cpf),
          courseTitle: course.title,
          instituteName: user.institute.name,
          lessonsCompleted: lessonIds.length,
        },
      },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    });

    // Generate PDF
    const pdfPath = await this.generatePDF(certificate);

    // Update certificate with PDF path
    await this.prisma.certificate.update({
      where: { id: certificate.id },
      data: { pdfPath },
    });

    // Create audit log
    await this.prisma.certificateAudit.create({
      data: {
        certificateId: certificate.id,
        event: 'ISSUED',
        ipAddress,
      },
    });

    return {
      certificate: { ...certificate, pdfPath },
      downloadUrl: `/certificates/download/${code}`,
      message: 'Certificado emitido com sucesso',
    };
  }

  // ============================================
  // ALUNO: Listar meus certificados
  // ============================================

  async getMyCertificates(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId },
      include: {
        course: { select: { id: true, title: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ============================================
  // PÚBLICO: Verificar certificado
  // ============================================

  async verifyCertificate(code: string, ipAddress?: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { code },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    });

    if (!certificate) {
      return {
        valid: false,
        message: 'Certificado não encontrado',
      };
    }

    // Create audit log for verification
    await this.prisma.certificateAudit.create({
      data: {
        certificateId: certificate.id,
        event: 'VERIFIED',
        ipAddress,
      },
    });

    const metadata = certificate.metadata as any;

    return {
      valid: true,
      certificate: {
        code: certificate.code,
        userName: metadata?.userName || certificate.user.name,
        courseTitle: metadata?.courseTitle || certificate.course.title,
        instituteName: metadata?.instituteName,
        issuedAt: certificate.issuedAt,
      },
    };
  }

  // ============================================
  // GESTOR: Listar certificados emitidos
  // ============================================

  async listCertificates(
    instituteId: string,
    from?: string,
    to?: string,
    courseId?: string,
  ) {
    const where: any = { instituteId };

    if (from || to) {
      where.issuedAt = {};
      if (from) where.issuedAt.gte = new Date(from);
      if (to) where.issuedAt.lte = new Date(to);
    }

    if (courseId) {
      where.courseId = courseId;
    }

    return this.prisma.certificate.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, profession: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ============================================
  // DOWNLOAD: Get PDF file path
  // ============================================

  async getCertificateForDownload(code: string, userId?: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { code },
    });

    if (!certificate) {
      throw new NotFoundException('Certificado não encontrado');
    }

    // If userId provided, verify ownership
    if (userId && certificate.userId !== userId) {
      throw new BadRequestException('Você não tem permissão para baixar este certificado');
    }

    if (!certificate.pdfPath || !fs.existsSync(certificate.pdfPath)) {
      // Regenerate PDF if missing
      const fullCert = await this.prisma.certificate.findUnique({
        where: { code },
        include: {
          user: { select: { name: true } },
          course: { select: { title: true } },
        },
      });
      const pdfPath = await this.generatePDF(fullCert as any);
      await this.prisma.certificate.update({
        where: { id: certificate.id },
        data: { pdfPath },
      });
      return pdfPath;
    }

    // Create download audit
    await this.prisma.certificateAudit.create({
      data: {
        certificateId: certificate.id,
        event: 'DOWNLOADED',
      },
    });

    return certificate.pdfPath;
  }

  // ============================================
  // Helpers
  // ============================================

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private maskCpf(cpf: string): string {
    // Show only last 3 digits: ***.***.***-XX
    return `***.***.*${cpf.slice(-3)}`;
  }

  private async generatePDF(certificate: any): Promise<string> {
    const metadata = certificate.metadata as any;
    const userName = metadata?.userName || certificate.user?.name || 'Aluno';
    const courseTitle = metadata?.courseTitle || certificate.course?.title || 'Curso';
    const instituteName = metadata?.instituteName || 'Educação Continuada';
    const issuedAt = new Date(certificate.issuedAt);

    const verifyUrl = `http://localhost:3000/verify/${certificate.code}`;

    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      type: 'png',
      width: 120,
      margin: 1,
    });

    return new Promise((resolve, reject) => {
      const fileName = `${certificate.code}.pdf`;
      const filePath = path.join(this.storagePath, fileName);

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 50,
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Background color
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8fafc');

      // Border
      doc
        .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
        .lineWidth(3)
        .stroke('#1e40af');

      // Inner border
      doc
        .rect(40, 40, doc.page.width - 80, doc.page.height - 80)
        .lineWidth(1)
        .stroke('#3b82f6');

      // Title
      doc
        .fillColor('#1e3a8a')
        .fontSize(42)
        .font('Helvetica-Bold')
        .text('CERTIFICADO', 0, 80, { align: 'center' });

      // Subtitle
      doc
        .fillColor('#475569')
        .fontSize(14)
        .font('Helvetica')
        .text('de Conclusão de Curso', 0, 135, { align: 'center' });

      // Main text
      doc
        .fillColor('#1e293b')
        .fontSize(16)
        .font('Helvetica')
        .text('Certificamos que', 0, 190, { align: 'center' });

      // Name
      doc
        .fillColor('#1e40af')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(userName.toUpperCase(), 0, 220, { align: 'center' });

      // Course completion text
      doc
        .fillColor('#1e293b')
        .fontSize(16)
        .font('Helvetica')
        .text('concluiu com êxito o curso', 0, 270, { align: 'center' });

      // Course title
      doc
        .fillColor('#1e40af')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(`"${courseTitle}"`, 0, 300, { align: 'center' });

      // Institution
      doc
        .fillColor('#475569')
        .fontSize(12)
        .font('Helvetica')
        .text(`oferecido por ${instituteName}`, 0, 345, { align: 'center' });

      // Date
      const dateStr = issuedAt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      doc
        .fillColor('#64748b')
        .fontSize(12)
        .font('Helvetica')
        .text(`Emitido em ${dateStr}`, 0, 380, { align: 'center' });

      // Signature line
      doc
        .moveTo(300, 440)
        .lineTo(500, 440)
        .lineWidth(1)
        .stroke('#94a3b8');

      doc
        .fillColor('#475569')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Educação Continuada', 300, 450, { width: 200, align: 'center' });

      doc
        .fillColor('#64748b')
        .fontSize(10)
        .font('Helvetica')
        .text('Coordenação', 300, 468, { width: 200, align: 'center' });

      // QR Code and verification info
      doc.image(qrBuffer, 100, 400, { width: 80 });

      doc
        .fillColor('#64748b')
        .fontSize(9)
        .font('Helvetica')
        .text('Verifique em:', 95, 485, { width: 90, align: 'center' });

      doc
        .fillColor('#3b82f6')
        .fontSize(8)
        .font('Helvetica')
        .text(certificate.code, 95, 498, { width: 90, align: 'center' });

      // Footer
      doc
        .fillColor('#94a3b8')
        .fontSize(8)
        .font('Helvetica')
        .text(
          `Código de verificação: ${certificate.code} | Escaneie o QR Code ou acesse /verify/${certificate.code}`,
          0,
          doc.page.height - 55,
          { align: 'center' },
        );

      doc.end();

      writeStream.on('finish', () => {
        resolve(filePath);
      });

      writeStream.on('error', reject);
    });
  }
}
