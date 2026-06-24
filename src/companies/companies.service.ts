import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import PDFDocument = require('pdfkit');
import * as path from 'path';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  async list(search?: string, page = 1, pageSize = 20) {
    const where = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        include: { vendor: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      companies: companies.map((c) => ({
        ...c,
        vendorCount: c.vendorId ? 1 : 0,
        assignedVendors: c.vendor ? [c.vendor] : [],
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        vendor: true,
      },
    });

    if (!company) throw new NotFoundException('Company not found');

    return {
      ...company,
      assignedVendors: company.vendor ? [company.vendor] : [],
    };
  }

  async create(dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        description: dto.description,
        logo: dto.logo,
        accentColor: dto.accentColor,
        status: dto.status,
        vendorId: dto.vendorId || null,
      },
    });

    return { company };
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const data: any = {
      name: dto.name,
      description: dto.description,
      logo: dto.logo,
      accentColor: dto.accentColor,
      status: dto.status,
    };

    if (dto.vendorId !== undefined) {
      data.vendorId = dto.vendorId || null;
    }

    const company = await this.prisma.company.update({
      where: { id },
      data,
    });

    return { company };
  }

  async delete(id: string) {
    await this.prisma.company.delete({ where: { id } });
    return { success: true };
  }

  async assignVendor(companyId: string, vendorId: string) {
    await this.prisma.company.update({
      where: { id: companyId },
      data: { vendorId },
    });
    return { success: true };
  }

  async unassignVendor(companyId: string, vendorId: string) {
    await this.prisma.company.updateMany({
      where: { id: companyId, vendorId },
      data: { vendorId: null },
    });
    return { success: true };
  }

  async getMine(vendorId: string) {
    const companies = await this.prisma.company.findMany({
      where: { vendorId },
    });

    return { companies };
  }

  async updateWorkspace(userId: string, supabaseId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, vendorId: userId },
    });

    if (!company) {
      throw new NotFoundException('Company not assigned to vendor');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { lastUsedCompanyId: companyId },
    });

    await this.supabase.syncUserMetadata(supabaseId, {
      name: user.name,
      role: user.role,
      last_used_company_id: companyId,
    });

    return { user };
  }
  async generateNdaPdf(companyId: string): Promise<NodeJS.ReadableStream> {
    // 1. Fetch Company details alongside relational Vendor definitions
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { vendor: true },
    });

    if (!company) {
      throw new NotFoundException('Company parameters not found');
    }

    // Dynamic document properties
    const clientName = company.name || '[Client Company Name]';
    const clientAddress = company.description || '[Client Address]';
    const designation = company.vendor?.designation || '[Designation]';
    const vendorName = company.vendor?.name || '[Authorized Signatory Name]';
    const effectiveDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\//g, '-'); 

    // 2. Instantiate a clean layout template instance (A4 size with standard margins)
    const doc = new PDFDocument({
  size: 'A4',
  margins: {
    top: 90,
    bottom: 80,
    left: 50,
    right: 50,
  },
  bufferPages: true,
});

doc.lineGap(4);
const logoPath = path.join(
  process.cwd(),
  'assets',
  'devforge-logo.png',
);

const drawHeader = () => {
  const pageWidth = doc.page.width;

  const logoWidth = 220;
  const logoX = (pageWidth - logoWidth) / 2;

  doc.image(logoPath, logoX, 15, {
    width: logoWidth,
  });
};


drawHeader();

doc.y = 90;
doc.page.margins.bottom = 100;
doc.lineGap(2);

    // ==================== PDF STYLING HELPER FUNCTIONS ====================
   const titleStyle = () =>
  doc
    .fillColor('#000000')
    .font('Times-Bold')
    .fontSize(20);

const headingStyle = () =>
  doc
    .fillColor('#000000')
    .font('Times-Bold')
    .fontSize(14);

const bodyStyle = () =>
  doc
    .fillColor('#000000')
    .font('Times-Roman')
    .fontSize(14);

const boldBodyStyle = () =>
  doc
    .fillColor('#000000')
    .font('Times-Bold')
    .fontSize(14);

    const signatureStyle = () =>
  doc
    .fillColor('#000000')
    .font('Times-Roman')
    .fontSize(12);

const signatureBoldStyle = () =>
  doc
    .fillColor('#000000')
    .font('Times-Bold')
    .fontSize(12);
    // =====================================================================

    // 1. Title Block
    titleStyle().text('MUTUAL NON-DISCLOSURE AGREEMENT', { align: 'center' });
    doc.moveDown(2);

    // 2. Opening Statement
    bodyStyle()
  .text(
    'This Mutual Non-Disclosure Agreement (“Agreement”) is made and entered into on ',
    { continued: true }
  );

doc
  .font('Times-Bold')
  .fontSize(14)
  .text(`${effectiveDate}.`);

bodyStyle(); // switch back to normal font
    doc.moveDown(0.5);
    bodyStyle().text('BY AND BETWEEN');
    doc.moveDown(0.5);

    // Devforge Details
   boldBodyStyle().text(
  'Devforge Technology Private Limited, ',
  {
    continued: true,
  },
);

bodyStyle().text(
  'a technology and software services company incorporated under the Companies Act, 2013,',
);

bodyStyle().text(
  'having its registered office at ',
  {
    continued: true,
  },
);

boldBodyStyle().text(
  'E-907, Ganesh Glory 11, Jagatpur Road, Ahmedabad 382470, Gujarat, India,',
);

doc.moveDown(0.5);

bodyStyle().text('GSTIN: 24AAKCD0077D1Z0');
bodyStyle().text('CIN: U62091GJ2023PTC140962');
bodyStyle().text('PAN: AAKCD0077D');
bodyStyle().text('Email: ', { continued: true });

doc
  .fillColor('#3b6e84')
  .text('connect@trydevforge.com', {
    link: 'mailto:connect@trydevforge.com',
    underline: true,
  });

bodyStyle().text('Website: ', { continued: true });

doc
  .fillColor('#3b6e84')
  .text('www.trydevforge.com', {
    link: 'https://www.trydevforge.com',
    underline: true,
  });

bodyStyle().text('Phone: ', { continued: true });

doc
  .fillColor('#3b6e84')
  .text('+91 93277 80842', {
    link: 'tel:+919327780842',
    underline: true,
  });

doc.fillColor('#000000');
    doc.moveDown(0.5);
    bodyStyle().text('AND');
    doc.moveDown(0.5);

    // Client Details
    boldBodyStyle().text(`${clientName},`);

bodyStyle().text(
  'a company incorporated under applicable laws, having its registered office at ',
  { continued: true },
);

boldBodyStyle().text(
  `${clientAddress}`,
  { continued: true },
);

bodyStyle().text(
  ', represented by ',
  { continued: true },
);

boldBodyStyle().text(
  `${vendorName}, ${designation}`,
  { continued: true },
);

bodyStyle().text(
  ',',
  { continued: true },
);

bodyStyle().text(
  '(hereinafter referred to as the "Client") Devforge and the Client are individually referred to as a "Party" and collectively as the "Parties".'
);
    doc.moveDown(1.5);

    // 3. Section Clauses
    headingStyle().text('1. PURPOSE AND SCOPE');
    doc.moveDown(0.5);
    bodyStyle().text(
      'The Parties desire to enter discussions, evaluations, negotiations, and/or execution of software development, web and mobile application development, cloud services, IT consulting, system architecture, maintenance, support, testing, deployment, and other related professional technology services (“Authorized Purpose”). In connection with the Authorized Purpose, each Party may disclose confidential Information to the other Party.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('2. DEFINITION OF CONFIDENTIAL INFORMATION');
    doc.moveDown(0.5);
    bodyStyle().text(
      '“Confidential Information” means all information disclosed by the Disclosing Party to the Receiving Party, whether orally, visually, electronically, digitally, or in writing, including but not limited to source code, object code, scripts, binaries, algorithms, and logic flows; software applications, platforms, APIs, SDKs, databases, and schemas; credentials, passwords, access keys, tokens, and infrastructure details; system architecture, deployment processes, and DevOps pipelines; UI/UX designs, wireframes, mockups, prototypes, and product roadmaps; technical documentation, specifications, manuals, and standard operating procedures; business strategies, plans, pricing, proposals, quotations, and contracts; financial information such as budgets, forecasts, and invoices; client, customer, vendor, or end-user data; trade secrets, know-how, inventions, research, and methodologies; and any other information that is marked as confidential or that should reasonably be understood to be confidential by its nature or the circumstances of disclosure.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('3. CONFIDENTIALITY OBLIGATIONS');
    doc.moveDown(0.5);
    bodyStyle().text(
      'The Receiving Party agrees and undertakes that it shall treat all Confidential Information as strictly confidential and proprietary, use the Confidential Information solely for the Authorized Purpose, and not disclose any Confidential Information to any third party without the prior written consent of the Disclosing Party. The Receiving Party shall restrict access to confidential information only to its employees, contractors, or advisors who have a legitimate need to know such information for the Authorized Purpose and shall ensure that all such persons are bound by written confidentiality obligations no less protective than those set forth herein. The Receiving Party further agrees to protect the Confidential Information using industry-standard administrative, technical, and physical safeguards and to immediately notify the Disclosing Party upon becoming aware of any unauthorized disclosure, access, or breach of Confidential Information.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('4. TANGIBLE, ELECTRONIC, AND DERIVATIVE MATERIALS');
    doc.moveDown(0.5);
    bodyStyle().text(
      'All confidential information provided in tangible, electronic, or digital form, including copies, notes, analyses, summaries, and derivative works, shall remain the property of the Disclosing Party. Such materials shall not be copied, reproduced, or distributed except as required for the Authorized Purpose.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('5. EXCEPTIONS TO CONFIDENTIAL INFORMATION');
    doc.moveDown(0.5);
    bodyStyle().text(
      'The confidentiality obligations shall not apply to information which the Receiving Party can demonstrate: a) Is or becomes publicly available without breach of this Agreement; b) Was lawfully known prior to disclosure; c) Is independently developed without reference to Confidential Information; d) Is disclosed pursuant to a valid legal or regulatory requirement, provided prompt notice is given where legally permissible.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('6. INTELLECTUAL PROPERTY RIGHTS');
    doc.moveDown(0.5);
    bodyStyle().text(
      'All Confidential Information shall remain the exclusive property of the Disclosing Party, and nothing in this Agreement shall be construed as granting, whether expressly or impliedly, any license, ownership, or other rights to the Receiving Party in or to such Confidential Information. Devforge shall retain exclusive ownership of all pre-existing intellectual property, including but not limited to its frameworks, libraries, tools, utilities, methodologies, templates, and reusable components. Any ownership of rights relating to project-specific deliverables shall be governed solely by the terms of a separate Service Agreement or applicable Statement of Work entered between the parties.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('7. DATA PROTECTION AND INFORMATION SECURITY');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Each Party agrees to implement reasonable technical and organizational measures to safeguard Confidential Information, to prevent any unauthorized access, loss, misuse, or alteration of such Confidential Information, and to comply with all applicable data protection and privacy laws and regulations, including the Digital Personal Data Protection Act, 2023 of India.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('8. NON-SOLICITATION');
    doc.moveDown(0.5);
    bodyStyle().text(
      'During the term of this Agreement and for twelve (12) months thereafter, neither Party shall solicit, induce, or hire employees or contractors of the other Party without prior written consent.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('9. NO PUBLICITY AND NON-DISCLOSURE OF RELATIONSHIP');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Neither Party shall disclose the existence of this Agreement, the business relationship, or project details, nor use the other Party’s name, logo, or trademarks for marketing, publicity, or portfolio purposes without prior written consent.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('10. RETURN OR DESTRUCTION OF CONFIDENTIAL INFORMATION');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Upon written request or termination, the Receiving Party shall promptly return or permanently destroy all confidential Information, including copies and derivatives, and certify such destruction if requested.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('11. TERM AND SURVIVAL');
    doc.moveDown(0.5);
    bodyStyle().text(
      'This Agreement shall remain in effect for five (5) years from the Effective Date. Confidentiality, intellectual property, non-solicitation, remedies, and liability provisions shall survive termination.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('12. REMEDIES AND INJUNCTIVE RELIEF');
    doc.moveDown(0.5);
    bodyStyle().text(
      'The Parties acknowledge that any breach may cause irreparable harm. The Disclosing Party shall be entitled to injunctive, equitable, and monetary relief in addition to any other remedies available under law.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('13. LIMITATION OF LIABILITY');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Neither Party shall be liable for indirect, incidental, special, or consequential damages, except in cases of willful misconduct, fraud, or breach of confidentiality obligations.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('14. INDEMNIFICATION');
    doc.moveDown(0.5);
    bodyStyle().text(
      'The Receiving Party agrees to indemnify and hold harmless the Disclosing Party from losses, damages, or expenses arising from breach of this Agreement.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('15. GOVERNING LAW AND JURISDICTION');
    doc.moveDown(0.5);
    bodyStyle().text(
      'This Agreement shall be governed by and construed in accordance with the laws of India. Courts at Ahmedabad, Gujarat shall have exclusive jurisdiction.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('16. ENTIRE AGREEMENT AND AMENDMENTS');
    doc.moveDown(0.5);
    bodyStyle().text(
      'This Agreement constitutes the entire understanding between the Parties. Any amendments must be in writing and signed by authorized representatives of both Parties.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('17. SEVERABILITY AND WAIVER');
    doc.moveDown(0.5);
    bodyStyle().text(
      'If any provision is held unenforceable, the remaining provisions shall continue in full force. Failure to enforce shall not constitute waiver.',
      { align: 'left' }
    );
    doc.moveDown(1.5);

    headingStyle().text('18. SIGNATURES');
    doc.moveDown(0.5);
    bodyStyle().text('IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.', { align: 'left' });
    doc.moveDown(1.5);

    const signatureY = doc.y + 10;

    // Left Entity: Devforge Technology Pvt Ltd
    signatureBoldStyle().text('For Devforge Technology Pvt Ltd', 50, signatureY);
    doc.moveDown(0.5);
    signatureStyle().text('Name: Vikram Modh');
    signatureStyle().text('Designation: CEO / Director');
    signatureStyle().text('Signature: ');
    signatureStyle().text('Date: ');

    // Right Entity: Client Company
    signatureBoldStyle().text(`For ${clientName}`, 330, signatureY);
    doc.moveDown(0.5);
    signatureStyle().text(`Name: ${vendorName}`, 330);
    signatureStyle().text(`Designation: ${designation}`, 330);
    signatureStyle().text('Signature: ', 330);
    signatureStyle().text('Date: ', 330);
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(i);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Logo
  const logoWidth = 220;
  const logoX = (pageWidth - logoWidth) / 2;
  doc.image(logoPath, logoX, 15, { width: logoWidth });

  // Footer — disable bottom margin temporarily
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0; // <-- key fix

  doc.y = pageHeight - 50; // force cursor above footer area

  
    doc
  .font('Times-Bold')
  .fontSize(14)
  .fillColor('#666666');

// Left
doc.text(
  'trydevforge.com',
  50,
  pageHeight - 50,
  {
    width: 180,
    align: 'left',
    lineBreak: false,
  }
);

// Center
doc.text(
  'connect@trydevforge.com',
  0,
  pageHeight - 50,
  {
    width: pageWidth,
    align: 'center',
    lineBreak: false,
  }
);

// Right
doc.text(
  '+91 93277 80842',
  pageWidth - 220,
  pageHeight - 50,
  {
    width: 170,
    align: 'right',
    lineBreak: false,
  }
);

  doc.page.margins.bottom = originalBottomMargin; // restore
}

doc.end();
return doc;
  }
}