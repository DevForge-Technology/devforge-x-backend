import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto } from './dto/contract.dto';
import { CommissionType, PhaseStatus } from '@prisma/client';
import PDFDocument = require('pdfkit');
import * as path from 'path';

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  async createContract(dto: CreateContractDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new BadRequestException('Company not found');
    }

    if (company.ndaStatus !== 'signed') {
      throw new ForbiddenException('Cannot create a contract until the NDA is signed');
    }

    const processedPhases = dto.phases.map((phase) => {
      let calculatedAmount = phase.commissionValue;

      if (phase.commissionType === CommissionType.percentage) {
        calculatedAmount = (dto.totalProjectValue * phase.commissionValue) / 100;
      }

      return {
        name: phase.name,
        dueDate: new Date(phase.dueDate),
        commissionType: phase.commissionType,
        commissionValue: phase.commissionValue,
        calculatedAmount: calculatedAmount,
        status: PhaseStatus.pending,
      };
    });

    return this.prisma.contract.create({
      data: {
        projectName: dto.projectName,
        totalProjectValue: dto.totalProjectValue,
        vendorId: dto.vendorId,
        companyId: dto.companyId,
        phases: processedPhases,
      },
    });
  }

  async findAllByCompany(companyId: string) {
  return this.prisma.contract.findMany({
    where: { companyId },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

  async findAllByVendor(vendorId: string) {
    return this.prisma.contract.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  }
  async generateContractPdf(
  companyId: string,
  dto: any,
): Promise<NodeJS.ReadableStream> {
  const company = await this.prisma.company.findUnique({
  where: { id: companyId },
  include: {
    vendor: true,
  },
});

if (!company) {
  throw new NotFoundException('Company not found');
}
const clientName = company.name;
const vendorName = company.vendor?.name || '';
const designation = company.vendor?.designation || '';
const clientEmail = company.vendor?.email || '';

const effectiveDate =
  dto.effectiveDate ||
  new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const contractValue = dto.contractValue || '';
const projectName = dto.projectName || '';
const duration = dto.duration || '';
const paymentTerms = dto.paymentTerms || '';
const scope = dto.scope || '';
const governingLaw = dto.governingLaw || 'United States';
const doc = new PDFDocument({
  size: 'A4',
  margins: {
    top: 60,
    bottom: 60,
    left: 55,
    right: 55,
  },
  bufferPages: true,
});
doc.registerFont(
  'Inter',
  path.join(process.cwd(), 'assets/fonts/Inter-Regular.ttf')
);

doc.registerFont(
  'InterBold',
  path.join(process.cwd(), 'assets/fonts/Inter-Bold.ttf')
);

doc.registerFont(
  'InterSemiBold',
  path.join(process.cwd(), 'assets/fonts/Inter-SemiBold.ttf')
);

doc.registerFont(
  'InterItalic',
  path.join(process.cwd(), 'assets/fonts/Inter-Italic.ttf')
);
const PRIMARY = '#14b8a6';
const DARK = '#0f172a';
const LIGHT = '#ecf9f7';
const BORDER = '#ccece8';
const TEXT = '#444444';
const sectionTitle = (number: string, title: string) => {
  if (doc.y + 55 > doc.page.height - 70) {
    doc.addPage({
        margins:{
          top: 60,
          bottom: 60,
          left: 55,
          right: 55,
        }
      });
    doc.y = 60;
  }
  doc.moveDown(0.8);

  doc
    .fillColor(PRIMARY)
    .font('InterBold')
    .fontSize(12)
    .text(`${number}`, { continued: true });

  doc
    .fillColor('#000000')
    .font('InterBold')
    .fontSize(12)
    .text(`   ${title}`);

  doc.moveDown(0.3);

  doc
    .strokeColor(PRIMARY)
    .lineWidth(1.2)
    .moveTo(55, doc.y)
    .lineTo(doc.page.width - 55, doc.y)
    .stroke();

  doc.moveDown(0.8);
};
const drawTable = (rows: Array<[string, string]>) => {
  const tableX = 55;
  const tableWidth = doc.page.width - 110;
  const leftWidth = 200;
  const rightWidth = tableWidth - leftWidth;

  rows.forEach(([label, value]) => {
    const rowHeight = 34;

    if (doc.y + rowHeight > doc.page.height - 70) {
      doc.addPage({
        margins:{
          top: 60,
          bottom: 60,
          left: 55,
          right: 55,
        }
      });
    }

    const y = doc.y;

    doc
      .rect(tableX, y, leftWidth, rowHeight)
      .fill('#ecf9f7');

    doc
      .rect(tableX + leftWidth, y, rightWidth, rowHeight)
      .fill('#ffffff');

    doc
      .rect(tableX, y, tableWidth, rowHeight)
      .lineWidth(0.8)
      .strokeColor(BORDER)
      .stroke();

    doc
      .moveTo(tableX + leftWidth, y)
      .lineTo(tableX + leftWidth, y + rowHeight)
      .strokeColor(BORDER)
      .stroke();

    doc
      .fillColor('#000')
      .font('InterSemiBold')
      .fontSize(9)
      .text(label, tableX + 10, y + 9);

    doc
      .fillColor(TEXT)
      .font('Inter')
      .fontSize(9)
      .text(value || '', tableX + leftWidth + 10, y + 9);

    doc.y = y + rowHeight;
  });

  doc.moveDown();
};
const ContainerGap=20;
doc.rect(
  ContainerGap,                              
  ContainerGap,                            
  doc.page.width - (ContainerGap * 2),       
  doc.page.height - (ContainerGap * 2)       
).fill(DARK);
doc.y=doc.page.height/2 - 150;

doc.moveDown();

doc.fillColor('white')
.font('InterBold')
.fontSize(30)
.text('CONTRACT', {
align:'center'
});

doc.fontSize(24)
.text('AGREEMENT',{
align:'center'
});

doc.moveDown();

doc.font('Inter')
.fontSize(12)
.fillColor('#8ef0e6')
.text('Between',{
align:'center'
});

doc.moveDown();

doc.font('InterBold')
.fontSize(18)
.fillColor('white')
.text('DevForge Technology',{
align:'center'
});

doc.fontSize(14)
.text('AND',{
align:'center'
});

doc.fontSize(18)
.text(clientName,{
align:'center'
});

doc.moveDown(2);

doc.font('Inter')
.fontSize(11)
.text(`Effective Date : ${effectiveDate}`,{
align:'center'
});

doc.text(`Project : ${projectName}`,{
align:'center'
});
doc.addPage({
  margins:{
    top: 60,
    bottom: 60,
    left: 55,
    right: 55,
  }
});
sectionTitle('1', 'CONTRACT DETAILS');

drawTable([
  ['Contract Number', dto.contractNumber || 'CNT-001'],
  ['Contract Date', effectiveDate],
  ['Service Provider', 'DevForge Technology'],
  ['Client Company', clientName],
  ['Client Representative', vendorName],
  ['Designation', designation],
  ['Contract Type', dto.contractType || 'Software Development Agreement'],
  ['Project Name', dto.projectName || 'Custom Software Development'],
  ['Project Duration', dto.projectDuration || '6 Months'],
  ['Contract Value', dto.contractValue ? `$${dto.contractValue}` : 'To be mutually agreed'],
  ['Payment Terms', dto.paymentTerms || 'Milestone Based'],
]);
doc.x=55;
doc.moveDown();
sectionTitle('2', 'SCOPE OF SERVICES');

doc
  .fillColor(TEXT)
  .font('Inter')
  .fontSize(10)
  .text(
    `DevForge Technology agrees to provide professional software development, system design, implementation, testing, deployment, and post-deployment support services to ${clientName}. The services shall be delivered according to the mutually agreed project requirements, technical specifications, milestones, and timelines documented during project planning.

The Client agrees to provide all required business information, approvals, and timely feedback necessary for successful execution of the project. Any change requests beyond the agreed scope may require additional cost, revised timelines, and written approval from both parties before implementation.`,
    {
      align: 'justify',
    },
  );

doc.moveDown(1.2);
sectionTitle('3', 'PAYMENT TERMS');

doc
  .fillColor(TEXT)
  .font('Inter')
  .fontSize(10)
  .text(
    `The Client agrees to pay DevForge Technology the agreed contract amount according to the milestone schedule specified in this Agreement. Payments shall become due upon successful completion of each milestone and submission of the corresponding invoice.

Any delay in payment beyond the agreed due date may result in suspension of project work until outstanding invoices are settled. All applicable taxes, government charges, and transaction fees shall be borne by the Client unless otherwise agreed in writing.`,
    {
      align: 'justify',
    },
  );

doc.moveDown(1.2);
sectionTitle('4', 'RESPONSIBILITIES OF BOTH PARTIES');

doc
  .fillColor(TEXT)
  .font('Inter')
  .fontSize(10)
  .text(
    `DevForge Technology shall assign qualified professionals to perform the contracted services with reasonable care, skill, and industry standards. The Client shall provide timely access to required systems, documentation, stakeholders, and approvals necessary for project completion.

Both parties agree to communicate regularly, cooperate in resolving project issues, and act in good faith throughout the engagement. Failure by either party to fulfil its obligations may affect project timelines and deliverables.`,
    {
      align: 'justify',
    },
  );

doc.moveDown(1.2);
sectionTitle('5', 'INTELLECTUAL PROPERTY');

doc
  .fillColor(TEXT)
  .font('Inter')
  .fontSize(10)
  .text(
    `Unless otherwise specified in writing, all pre-existing intellectual property, software frameworks, reusable components, methodologies, and proprietary tools developed or owned by DevForge Technology shall remain its exclusive property.

Upon full payment of the agreed contract value, ownership of the final project deliverables specifically developed for the Client shall transfer to the Client, excluding reusable libraries, third-party software, and DevForge's internal development assets.`,
    {
      align: 'justify',
    },
  );

doc.moveDown(1.2);
sectionTitle('6', 'CONFIDENTIALITY');

doc
  .fillColor(TEXT)
  .font('Inter')
  .fontSize(10)
  .text(
    `Both parties agree to maintain strict confidentiality regarding all business information, technical documentation, source code, pricing, customer information, and proprietary materials exchanged during the execution of this Agreement.

Neither party shall disclose confidential information to any third party without prior written consent except where disclosure is required by applicable law. These confidentiality obligations shall survive termination of this Agreement for a period of three (3) years.`,
    {
      align: 'justify',
    },
  );

doc.moveDown(1.2);
sectionTitle('7', 'TERMINATION');

doc
  .fillColor(TEXT)
  .font('Inter')
  .fontSize(10)
  .text(
    `Either party may terminate this Agreement by providing thirty (30) days written notice to the other party. Upon termination, the Client shall pay for all completed work and approved deliverables up to the effective termination date.

Termination shall not affect any accrued rights, payment obligations, confidentiality requirements, or intellectual property provisions that are intended to survive completion or termination of this Agreement.`,
    {
      align: 'justify',
    },
  );

doc.moveDown(1.2);
sectionTitle('8', 'GOVERNING LAW');

doc
  .fillColor(TEXT)
  .font('Inter')
  .fontSize(10)
  .text(
    `This Agreement shall be governed by and interpreted in accordance with the applicable laws mutually agreed by both parties. Any disputes arising under this Agreement shall first be resolved through good-faith negotiations. If a resolution cannot be reached, the dispute shall be referred to mediation or arbitration before initiating legal proceedings.`,
    {
      align: 'justify',
    },
  );

doc.moveDown(1.2);
sectionTitle('9', 'SIGNATURES');

const requiredHeight = 280;

if (doc.y + requiredHeight > doc.page.height - 70) {
  doc.addPage({
        margins:{
          top: 60,
          bottom: 60,
          left: 55,
          right: 55,
        }
      });
}

doc
  .fillColor(TEXT)
  .font('Inter')
  .fontSize(10)
  .text(
    `By signing below, both parties acknowledge that they have read, understood, and agree to all terms and conditions contained in this Contract Agreement. This Agreement becomes effective from the Contract Date and shall remain binding until all contractual obligations have been fulfilled.`,
    {
      align: 'justify',
    },
  );

doc.moveDown(2);
const cardWidth = 220;
const cardHeight = 240;
const gap = 25;

const leftX = 55;
const rightX = leftX + cardWidth + gap;
const startY = doc.y;

const headerColor = '#00bdbe';
const borderColor = '#d7e8e7';
doc.roundedRect(leftX, startY, cardWidth, cardHeight, 6)
   .lineWidth(1)
   .strokeColor(borderColor)
   .stroke();

doc.rect(leftX, startY, cardWidth, 28)
   .fill(headerColor);

doc.fillColor('#ffffff')
   .font('InterBold')
   .fontSize(10)
   .text(
      'DEVFORGE TECHNOLOGY',
      leftX,
      startY + 8,
      {
         width: cardWidth,
         align: 'center'
      }
   );

let y = startY + 50;

doc.fillColor('#666666')
   .font('InterItalic')
   .fontSize(8)
   .text('Authorised Signature', leftX + 15, y);

y += 30;

doc.moveTo(leftX + 15, y)
   .lineTo(leftX + cardWidth - 15, y)
   .strokeColor('#9ecfcf')
   .stroke();

y += 18;

doc.font('InterBold')
   .fillColor(TEXT)
   .fontSize(9)
   .text('Vikram Modh', leftX + 15, y);

y += 22;

doc.font('Inter')
   .text('Founder & CEO', leftX + 15, y);

y += 22;

doc.text('DevForge Technology', leftX + 15, y);

y += 22;

doc.text(`Date : ${effectiveDate}`, leftX + 15, y);
doc.roundedRect(rightX, startY, cardWidth, cardHeight, 6)
   .lineWidth(1)
   .strokeColor(borderColor)
   .stroke();

doc.rect(rightX, startY, cardWidth, 28)
   .fill(headerColor);

doc.fillColor('#ffffff')
   .font('InterBold')
   .fontSize(10)
   .text(
      clientName.toUpperCase(),
      rightX,
      startY + 8,
      {
         width: cardWidth,
         align: 'center'
      }
   );

let y2 = startY + 50;

doc.fillColor('#666666')
   .font('InterItalic')
   .fontSize(8)
   .text('Authorised Signature', rightX + 15, y2);

y2 += 30;

doc.moveTo(rightX + 15, y2)
   .lineTo(rightX + cardWidth - 15, y2)
   .strokeColor('#9ecfcf')
   .stroke();

y2 += 18;

doc.font('InterBold')
   .fillColor(TEXT)
   .fontSize(9)
   .text(vendorName, rightX + 15, y2);

y2 += 22;

doc.font('Inter')
   .text(designation, rightX + 15, y2);

y2 += 22;

doc.text(clientName, rightX + 15, y2);

y2 += 22;

doc.text(`Date : ${effectiveDate}`, rightX + 15, y2);
doc.end();
  return doc;
}
}