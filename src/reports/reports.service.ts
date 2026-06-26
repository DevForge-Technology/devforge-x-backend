import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { UploadReportDto } from './dto/report.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private mailService: MailService,
  ) {}

  async uploadReport(
    vendorId: string,
    companyId: string,
    file: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (company.vendorId !== vendorId) {
      throw new BadRequestException('Vendor does not own this company');
    }

    const folderPath = `reports/${companyId}`;
    const uploadedFile = await this.cloudinaryService.uploadFile(file, folderPath);

    const report = await this.prisma.report.create({
      data: {
        fileUrl: (uploadedFile as any).secure_url,
        filePublicId: (uploadedFile as any).public_id,
        fileType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
        vendorId,
        companyId,
      },
    });

    return report;
  }

  async getCompanyReports(userId: string, userRole: string, companyId: string, page = 1, pageSize = 10) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Admins can see all reports, vendors can only see reports from companies they own
    if (userRole === 'vendor' && company.vendorId !== userId) {
      throw new BadRequestException('Vendor does not own this company');
    }

    const skip = (page - 1) * pageSize;
    const whereClause = userRole === 'admin'
      ? { companyId }
      : { companyId, vendorId: userId };

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({
        where: whereClause,
      }),
    ]);

    return {
      data: reports,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async deleteReport(vendorId: string, reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.vendorId !== vendorId) {
      throw new BadRequestException('Vendor does not own this report');
    }

    await this.cloudinaryService.deleteFile(report.filePublicId);

    return this.prisma.report.delete({
      where: { id: reportId },
    });
  }



  async deleteCompanyReports(companyId: string) {
    const reports = await this.prisma.report.findMany({
      where: { companyId },
    });

    for (const report of reports) {
      await this.cloudinaryService.deleteFile(report.filePublicId);
    }

    return this.prisma.report.deleteMany({
      where: { companyId },
    });
  }
}




