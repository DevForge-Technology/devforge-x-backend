import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private mailService: MailService,
  ) {}

  async createReport(data: { 
  companyId: string, 
  vendorId?: string | null, 
  type: 'GENERAL' | 'NDA', 
  status: 'pending' | 'uploaded' | 'signed' | 'rejected', 
  fileName: string 
}) {
  let resolvedVendorId = data.vendorId;
  if (!resolvedVendorId) {
    const company = await this.prisma.company.findUnique({
      where: { id: data.companyId },
    });
    resolvedVendorId = company?.vendorId;
  }

  return await this.prisma.report.create({
    data: {
      companyId: data.companyId,
      vendorId: resolvedVendorId || '000000000000000000000000', 
      type: data.type,
      status: data.status,
      fileName: data.fileName,
      fileUrl: '',
      filePublicId: '',
      fileSize: 0,
      fileType: 'application/pdf',
    },
  });
}

  async approveNdaReport(companyId: string) {
    const report = await this.prisma.report.findFirst({
      where: {
        companyId,
        type: 'NDA',
        status: 'uploaded',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (report) {
      return await this.prisma.report.update({
        where: { id: report.id },
        data: { status: 'signed' },
      });
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    
    return await this.prisma.report.create({
      data: {
        companyId,
        vendorId: company?.vendorId || '000000000000000000000000',
        type: 'NDA',
        status: 'signed',
        fileName: 'Approved NDA',
        fileUrl: company?.ndaUrl || '',
        filePublicId: '',
        fileSize: 0,
        fileType: 'application/pdf',
      },
    });
  }

async getPendingNdaReports(companyId: string) {
  return await this.prisma.report.findMany({
    where: {
      companyId: companyId,
      type: 'NDA',
    },
    orderBy: { createdAt: 'desc' },
  });
}

  async uploadReport(
    vendorId: string,
    companyId: string,
    file: any,
    type: 'GENERAL' | 'NDA' = 'GENERAL',
    reportId?: string,
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

    if (reportId) {
      const existingReport = await this.prisma.report.findUnique({
        where: { id: reportId },
      });

      if (!existingReport) {
        throw new NotFoundException('Report not found');
      }

      if (existingReport.vendorId !== vendorId || existingReport.companyId !== companyId) {
        throw new BadRequestException('Report does not belong to this vendor or company');
      }

      if (existingReport.filePublicId) {
        try {
          await this.cloudinaryService.deleteFile(existingReport.filePublicId);
        } catch (err) {
          console.error('Failed to delete old file from Cloudinary:', err);
        }
      }

      const uploadedFile = await this.cloudinaryService.uploadFile(file, folderPath);

      const updatedReport = await this.prisma.report.update({
        where: { id: reportId },
        data: {
          fileUrl: (uploadedFile as any).secure_url,
          filePublicId: (uploadedFile as any).public_id,
          fileType: file.mimetype,
          fileName: file.originalname,
          fileSize: file.size,
          status: type === 'NDA' ? 'uploaded' : undefined,
        },
      });

      if (type === 'NDA') {
        await this.prisma.company.update({
          where: { id: companyId },
          data: {
            ndaStatus: 'uploaded',
            ndaUrl: (uploadedFile as any).secure_url,
          },
        });
      }

      return updatedReport;
    }

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
        type: type,
        status: type === 'NDA' ? 'uploaded' : undefined,
      },
    });

    if (type === 'NDA') {
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          ndaStatus: 'uploaded',
          ndaUrl: (uploadedFile as any).secure_url,
        },
      });
    }

    return report;
  }

  async resetReport(vendorId: string, reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.vendorId !== vendorId) {
      throw new BadRequestException('Vendor does not own this report');
    }

    if (report.filePublicId) {
      try {
        await this.cloudinaryService.deleteFile(report.filePublicId);
      } catch (err) {
        console.error('Failed to delete file from Cloudinary:', err);
      }
    }

    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        fileUrl: '',
        filePublicId: '',
        fileSize: 0,
        fileType: 'application/pdf',
        status: 'pending',
      },
    });

    if (report.type === 'NDA') {
      await this.prisma.company.update({
        where: { id: report.companyId },
        data: {
          ndaStatus: 'pending',
          ndaUrl: null,
        },
      });
    }

    return updatedReport;
  }

  async getCompanyReports(userId: string, userRole: string, companyId: string, type?: 'GENERAL' | 'NDA', page = 1, pageSize = 10) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (userRole === 'vendor' && company.vendorId !== userId) {
      throw new BadRequestException('Vendor does not own this company');
    }

    const skip = (page - 1) * pageSize;
    const whereClause: any = userRole === 'admin'
      ? { companyId }
      : { companyId, vendorId: userId };

    if (type) {
      whereClause.type = type;
    }

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

    if (report.filePublicId) {
      await this.cloudinaryService.deleteFile(report.filePublicId);
    }

    if (report.type === 'NDA') {
      await this.prisma.company.update({
        where: { id: report.companyId },
        data: {
          ndaStatus: 'pending',
          ndaUrl: null,
        },
      });
    }

    return this.prisma.report.delete({
      where: { id: reportId },
    });
  }

  async deleteCompanyReports(companyId: string) {
    const reports = await this.prisma.report.findMany({
      where: { companyId },
    });

    for (const report of reports) {
      if (report.filePublicId) {
        await this.cloudinaryService.deleteFile(report.filePublicId);
      }
    }

    return this.prisma.report.deleteMany({
      where: { companyId },
    });
  }
}