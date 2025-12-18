import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  Req,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CertificatesService } from './certificates.service';
import * as fs from 'fs';

@Controller()
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  // ============================================
  // ALUNO ENDPOINTS
  // ============================================

  // Rate limit: 10 requests per minute for certificate issuance
  @Post('courses/:courseId/certificates')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async issueCertificate(
    @Param('courseId') courseId: string,
    @Request() req: any,
    @Req() request: ExpressRequest,
  ) {
    const ipAddress = request.ip || request.headers['x-forwarded-for']?.toString();
    return this.certificatesService.issueCertificate(
      req.user.id,
      courseId,
      ipAddress,
    );
  }

  @Get('me/certificates')
  @UseGuards(JwtAuthGuard)
  async getMyCertificates(@Request() req: any) {
    return this.certificatesService.getMyCertificates(req.user.id);
  }

  // ============================================
  // DOWNLOAD ENDPOINTS
  // ============================================

  @Get('certificates/download/:code')
  @UseGuards(JwtAuthGuard)
  async downloadCertificate(
    @Param('code') code: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const pdfPath = await this.certificatesService.getCertificateForDownload(
      code,
      req.user.id,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=certificado-${code}.pdf`,
    );

    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);
  }

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  @Get('public/certificates/:code')
  async verifyCertificate(
    @Param('code') code: string,
    @Req() request: ExpressRequest,
  ) {
    const ipAddress = request.ip || request.headers['x-forwarded-for']?.toString();
    return this.certificatesService.verifyCertificate(code, ipAddress);
  }

  // ============================================
  // GESTOR ENDPOINTS
  // ============================================

  @Get('certificates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async listCertificates(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.certificatesService.listCertificates(
      req.user.instituteId,
      from,
      to,
      courseId,
    );
  }
}
