import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Injectable()
export class InvitesService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async create(dto: CreateInviteDto, creatorId: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays || 7));

    const invite = await this.prisma.inviteToken.create({
      data: {
        instituteId: dto.instituteId,
        hospitalId: dto.hospitalId,
        unitId: dto.unitId,
        systemRole: dto.systemRole,
        profession: dto.profession,
        invitedEmail: dto.invitedEmail,
        expiresAt,
        createdByUserId: creatorId,
      },
    });

    const baseUrl = process.env.WEB_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite/${invite.token}`;

    console.log('📧 Convite criado:');
    console.log(`   URL: ${inviteUrl}`);
    console.log(`   Email: ${dto.invitedEmail || '(qualquer)'}`);
    console.log(`   Expira em: ${expiresAt.toISOString()}`);

    return {
      id: invite.id,
      token: invite.token,
      profession: invite.profession,
      invitedEmail: invite.invitedEmail,
      expiresAt: invite.expiresAt,
      inviteUrl,
    };
  }

  async findByToken(token: string) {
    const invite = await this.prisma.inviteToken.findUnique({
      where: { token },
      include: {
        institute: { select: { id: true, name: true } },
        hospital: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
    });

    if (!invite) {
      throw new NotFoundException('Convite não encontrado');
    }

    const isExpired = new Date() > invite.expiresAt;
    const isUsed = invite.usedAt !== null;

    return {
      id: invite.id,
      token: invite.token,
      profession: invite.profession,
      systemRole: invite.systemRole,
      invitedEmail: invite.invitedEmail,
      institute: invite.institute,
      hospital: invite.hospital,
      unit: invite.unit,
      expiresAt: invite.expiresAt,
      isValid: !isExpired && !isUsed,
      isExpired,
      isUsed,
    };
  }

  async findByInstitute(instituteId: string) {
    const invites = await this.prisma.inviteToken.findMany({
      where: { instituteId },
      include: {
        hospital: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const now = new Date();
    return invites.map((invite) => {
      const isExpired = now > invite.expiresAt;
      const isUsed = invite.usedAt !== null;
      let status: 'valid' | 'expired' | 'used';
      if (isUsed) {
        status = 'used';
      } else if (isExpired) {
        status = 'expired';
      } else {
        status = 'valid';
      }

      return {
        id: invite.id,
        token: invite.token,
        profession: invite.profession,
        systemRole: invite.systemRole,
        invitedEmail: invite.invitedEmail,
        hospital: invite.hospital,
        unit: invite.unit,
        createdBy: invite.createdBy,
        expiresAt: invite.expiresAt,
        usedAt: invite.usedAt,
        createdAt: invite.createdAt,
        status,
      };
    });
  }

  async accept(token: string, dto: AcceptInviteDto) {
    const invite = await this.prisma.inviteToken.findUnique({
      where: { token },
    });

    if (!invite) {
      throw new NotFoundException('Convite não encontrado');
    }

    if (invite.usedAt) {
      throw new BadRequestException('Este convite já foi utilizado');
    }

    if (new Date() > invite.expiresAt) {
      throw new BadRequestException('Este convite expirou');
    }

    // Usar email do DTO
    const email = dto.email;

    // Verificar se email já existe
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUserByEmail) {
      throw new ConflictException('Este email já está cadastrado');
    }

    // Verificar se CPF já existe
    const existingUserByCpf = await this.prisma.user.findUnique({
      where: { cpf: dto.cpf },
    });
    if (existingUserByCpf) {
      throw new ConflictException('Este CPF já está cadastrado');
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Criar usuário e marcar convite como usado em transação
    const result = await this.prisma.$transaction(async (tx) => {
      // Criar usuário
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: dto.name,
          cpf: dto.cpf,
          phone: dto.phone,
          profession: invite.profession,
          professionalRegister: dto.professionalRegister,
          role: invite.systemRole,
          instituteId: invite.instituteId,
        },
      });

      // Se tem unidade definida, criar assignment
      if (invite.unitId) {
        await tx.userUnitAssignment.create({
          data: {
            userId: user.id,
            unitId: invite.unitId,
            isPrimary: true,
          },
        });
      }

      // Marcar convite como usado
      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      // Log de auditoria
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_REGISTERED',
          entity: 'User',
          entityId: user.id,
          metadata: { inviteId: invite.id },
        },
      });

      return user;
    });

    // Gerar token JWT
    const payload = { sub: result.id, email: result.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
        instituteId: result.instituteId,
        profession: result.profession,
      },
    };
  }
}
