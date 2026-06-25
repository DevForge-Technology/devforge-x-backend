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
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { vendor: true },
    });

    if (!company) {
      throw new NotFoundException('Company parameters not found');
    }

    const clientName = company.name || '[Client Company Name]';
    const clientAddress = company.description || '[Client Address]';
    const designation = company.vendor?.designation || 'Founder & CEO';
    const vendorName = company.vendor?.name || '[Authorized Signatory Name]';
    const clientEmail = company.vendor?.email || '[Client Email Address]';
    
    const effectiveDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }); 

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

    doc.lineGap(4);

    const subClauseNumStyle = () => doc.fillColor('#14b8a6').font('InterBold').fontSize(10); 
    const subClauseHeadingStyle = () => doc.fillColor('#000000').font('InterBold').fontSize(10); 
    const bodyStyle = () => doc.fillColor('#444444').font('Inter').fontSize(9.5); 
    const boldLabelStyle = () => doc.fillColor('#000000').font('InterBold').fontSize(9.5);

    const addClauseSeparator = () => {
      doc.moveDown(1.2);
      const currentY = doc.y;
      
      if (currentY < doc.page.height - 80) {
        doc.strokeColor('#e5e7eb')
           .lineWidth(0.75)
           .moveTo(55, currentY)
           .lineTo(doc.page.width - 55, currentY)
           .stroke();
        doc.moveDown(1.2);
      }
    };

    const renderSectionHeader = (num: string, title: string) => {
      const headerX = 55;
      const headerY = doc.y;
      const headerWidth = doc.page.width - 110;
      const headerHeight = 42;

      doc.rect(headerX, headerY, headerWidth, headerHeight).fill('#14b8a6');
      
      doc.fillColor('#FFFFFF').font('InterBold').fontSize(11);
      doc.text(`${num}      ${title}`, headerX + 18, headerY + 13);
      
      doc.x = 55;
      doc.y = headerY + headerHeight + 22;
    };

    const startY = 60;
    const bannerHeight = 280; 
    const bannerWidth = doc.page.width - 110; 
    
    doc.rect(55, startY, bannerWidth, bannerHeight).fill('#1a1a1a');
    doc.strokeColor('#5fa39d').lineWidth(2).moveTo(100, startY + 30).lineTo(250, startY + 30).stroke();
    
    doc.y = startY + 45;
    doc.fillColor('#FFFFFF').font('InterBold').fontSize(34);
    doc.text('MUTUAL', { align: 'center', width: bannerWidth });
    doc.text('NON-DISCLOSURE', { align: 'center', width: bannerWidth });
    doc.text('AGREEMENT', { align: 'center', width: bannerWidth });
    
    doc.moveDown(0.5);
    doc.fillColor('#5fa39d').font('Inter').fontSize(12);
    doc.text('Protecting shared ideas — so the conversation can begin', { align: 'center', width: bannerWidth });
    
    doc.moveDown(1);
    doc.fillColor('#999999').font('InterItalic').fontSize(8.5);
    doc.text('Beyond Boundaries. Built for Success.', { align: 'center', width: bannerWidth });

    doc.x = 55;
    doc.y = startY + bannerHeight + 20;

    const boxX = 55;
    const boxY = doc.y;
    const boxWidth = doc.page.width - 110;
    const boxHeight = 115;

    doc.rect(boxX, boxY, boxWidth, boxHeight).fill('#ecf9f7');
    doc.rect(boxX, boxY, boxWidth, boxHeight).lineWidth(1).strokeColor('#ccece8').stroke();
    doc.rect(boxX, boxY, 4, boxHeight).fill('#14b8a6');

doc.y = boxY + 18;
doc.x = boxX + 22;

doc.fillColor('#555555')
  .fontSize(9.5)
  .lineGap(6);

doc.font('InterBold').text(
  'Purpose of this Agreement. ',
  {
    continued: true,
    width: boxWidth - 50,
    align: 'justify',
  }
);

doc.font('Inter').text(
  'DevForge Technology and the Prospective Client wish to explore a potential business relationship. To enable open, candid discussions — including product ideas, business models, technical designs, and strategy — both parties agree to hold each other\'s information in strict confidence. ',
  {
    continued: true,
    width: boxWidth - 50,
    align: 'justify',
  }
);

doc.font('InterBold').text(
  'This agreement is fully mutual: both parties are equally protected.',
  {
    width: boxWidth - 50,
    align: 'justify',
  }
);
    doc.x = 55;
    doc.y = boxY + boxHeight + 15;
    
    const tableX = 55;
    const tableY = doc.y;
    const tableWidth = doc.page.width - 110;
    const headerHeight = 25;
    const contentHeight = 115; 
    const totalTableHeight = headerHeight + contentHeight;
    const colWidth = tableWidth / 2;

    doc.rect(tableX, tableY, tableWidth, totalTableHeight).lineWidth(1).strokeColor('#bce6e1').stroke();
    doc.rect(tableX, tableY, tableWidth, headerHeight).fill('#14b8a6');
    doc.lineWidth(1).strokeColor('#bce6e1').moveTo(tableX + colWidth, tableY).lineTo(tableX + colWidth, tableY + totalTableHeight).stroke();

    const textPadding = 12;
    const textWidth = colWidth - (textPadding * 2);

    doc.y = tableY + headerHeight + textPadding;
    doc.x = tableX + textPadding;
    doc.fillColor('#222222').lineGap(3);
    
    doc.font('InterBold').fontSize(9).text('DevForge Technology', { width: textWidth });
    doc.font('Inter').fontSize(9);
    doc.text('Address: E-907, Ganesh Glory 11, Jagatpur Rd, S.G Highway, Gota, Ahmedabad, Gujarat 382470', { width: textWidth });
    doc.text('Email: connect@trydevforge.com', { width: textWidth });
    doc.text('Phone: +91 93277 80842', { width: textWidth });
    doc.text(`Representative: Vikram Modh, Director & CEO`, { width: textWidth });

    doc.y = tableY + headerHeight + textPadding; 
    doc.x = tableX + colWidth + textPadding;     
    doc.fillColor('#222222').lineGap(3);
    
    doc.font('InterBold').fontSize(9).text(clientName, { width: textWidth });
    doc.font('Inter').fontSize(9);
    doc.text('ABN / Registration: ', { width: textWidth });
    doc.text(`Address: ${clientAddress ? clientAddress : ''}`, { width: textWidth });
    doc.text(`Email: ${clientEmail ? clientEmail : ''}`, { width: textWidth });
    doc.text('Phone: ', { width: textWidth });
    doc.text(`Representative: ${vendorName}, ${designation}`, { width: textWidth });

    const metaTableY = tableY + totalTableHeight + 12; 
    const metaHeaderHeight = 25;
    const metaContentHeight = 25;
    const totalMetaHeight = metaHeaderHeight + metaContentHeight;

    doc.rect(tableX, metaTableY, tableWidth, totalMetaHeight).lineWidth(1).strokeColor('#bce6e1').stroke();
    doc.rect(tableX, metaTableY, tableWidth, metaHeaderHeight).fill('#14b8a6');
    doc.lineWidth(1).strokeColor('#bce6e1').moveTo(tableX + colWidth, metaTableY).lineTo(tableX + colWidth, metaTableY + totalMetaHeight).stroke();

    doc.y = metaTableY + metaHeaderHeight + 6;
    doc.x = tableX + textPadding;
    doc.fillColor('#222222').font('Inter').fontSize(9);
    doc.text(effectiveDate, { width: textWidth });

    doc.y = metaTableY + metaHeaderHeight + 6;
    doc.x = tableX + colWidth + textPadding;
    doc.text('United States', { width: textWidth });

    doc.x = 55;
    doc.y = metaTableY + totalMetaHeight + 20;

    renderSectionHeader('01', 'DEFINITIONS');

    doc.addPage();

    subClauseNumStyle().text('1.1', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Confidential Information');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Means any information disclosed by one party (Disclosing Party) to the other party (Receiving Party), whether orally, in writing, electronically, or by any other means, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure. Confidential Information includes, without limitation: business plans, product concepts, technical specifications, software, source code, AI model architectures, designs, financial data, customer lists, pricing, marketing strategies, and any other proprietary or commercially sensitive information.',
      { align: 'justify' }
    );
    addClauseSeparator();

    subClauseNumStyle().text('1.2', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Purpose');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Means the evaluation and discussion of a potential business engagement or collaboration between the parties, including but not limited to AI product development, software engineering, workflow automation, consulting, or technology services provided by DevForge Technology.',
      { align: 'justify' }
    );
    addClauseSeparator();

    subClauseNumStyle().text('1.3', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Representatives');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Means a party\'s employees, contractors, advisors, and agents who have a need to know the Confidential Information for the Purpose and who are bound by confidentiality obligations no less protective than those set out in this Agreement.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);

    renderSectionHeader('02', 'CONFIDENTIALITY OBLIGATIONS');

    subClauseNumStyle().text('2.1', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Non-Disclosure');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Each Receiving Party agrees to: (a) hold all Confidential Information of the Disclosing Party in strict confidence; (b) not disclose any Confidential Information to any third party without the prior written consent of the Disclosing Party; (c) use the Confidential Information solely for the Purpose; and (d) protect the Confidential Information using at least the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.',
      { align: 'justify' }
    );
    addClauseSeparator();

    subClauseNumStyle().text('2.2', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Permitted Disclosure to Representatives');
    doc.moveDown(0.5);
    bodyStyle().text(
      'A Receiving Party may disclose Confidential Information to its Representatives solely to the extent necessary for the Purpose, provided that such Representatives are informed of the confidential nature of the information and are bound by obligations of confidentiality at least as protective as those set forth herein. Each party remains responsible for any breach of this Agreement by its Representatives.',
      { align: 'justify' }
    );
    addClauseSeparator();

    subClauseNumStyle().text('2.3', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('No Licence or Transfer of IP');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Nothing in this Agreement grants either party any right, title, interest, or licence in or to the other party\'s Confidential Information, intellectual property, patents, trade marks, or any other proprietary rights. All Confidential Information remains the sole and exclusive property of the Disclosing Party. No IP is transferred or licensed by virtue of disclosure under this Agreement.',
      { align: 'justify' }
    );
    addClauseSeparator();

    subClauseNumStyle().text('2.4', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('No Warranty on Information');
    doc.moveDown(0.5);
    bodyStyle().text(
      'All Confidential Information is provided on an \'as-is\' basis. The Disclosing Party makes no representation or warranty express or implied as to the accuracy, completeness, currency, or fitness for any purpose of any Confidential Information disclosed. The Receiving Party accepts full responsibility for any reliance it places on Confidential Information received under this Agreement.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);

    renderSectionHeader('03', 'EXCLUSIONS FROM CONFIDENTIALITY');

    subClauseNumStyle().text('3.1', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Exclusions');
    doc.moveDown(0.5);
    bodyStyle().text(
      'The obligations in Section 2 do not apply to information that the Receiving Party can demonstrate by contemporaneous written records: (a) was already known to it at the time of disclosure, without restriction; (b) is or becomes publicly available through no act or omission of the Receiving Party; (c) was rightfully received from a third party without confidentiality restrictions; (d) was independently developed by the Receiving Party without reference to or use of the Confidential Information; or (e) is required to be disclosed by applicable law, court order, or regulatory authority provided that the Receiving Party gives the Disclosing Party prompt written notice (where legally permitted), cooperates with any effort to seek a protective order, and discloses only the minimum information required.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);
    
    renderSectionHeader('04', 'TERM & TERMINATION');

    subClauseNumStyle().text('4.1', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Duration');
    doc.moveDown(0.5);
    bodyStyle().text(
      'This Agreement commences on the Effective Date and remains in force for a period of two (2) years unless earlier terminated by either party upon thirty (30) days\' written notice to the other. Notwithstanding termination or expiry, the confidentiality obligations in Section 2 shall survive and continue in full force for a further period of three (3) years after the date of termination or expiry.',
      { align: 'justify' }
    );
    addClauseSeparator();

    subClauseNumStyle().text('4.2', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Return or Destruction of Information');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Upon termination of this Agreement, or upon written request by the Disclosing Party at any time, the Receiving Party shall promptly: (a) return to the Disclosing Party all Confidential Information in its possession or control; or (b) securely destroy all such Confidential Information, including any copies, extracts, or notes; and (c) provide written certification confirming such return or destruction, except to the extent that retention is required by applicable law or regulatory obligation.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);

    renderSectionHeader('05', 'ADDITIONAL PROTECTIONS');

    subClauseNumStyle().text('5.1', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Non-Solicitation');
    doc.moveDown(0.5);
    bodyStyle().text(
      'During the term of this Agreement and for a period of twelve (12) months following its termination or expiry, neither party shall, without the prior written consent of the other party: (a) directly or indirectly solicit, recruit, or induce any employee, contractor, or consultant of the other party who was involved in the discussions to terminate their engagement; or (b) hire or engage any such person. This clause does not prevent either party from engaging a person who responds independently to a bona fide general public advertisement not specifically targeting that individual.',
      { align: 'justify' }
    );
    addClauseSeparator();

    subClauseNumStyle().text('5.2', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('No Publicity or Announcements');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Neither party shall, without the prior written consent of the other party, disclose to any third party: (a) the existence of this Agreement; (b) the fact that the parties are in discussions; or (c) the nature or subject matter of those discussions. Consent shall not be unreasonably withheld where disclosure is required by applicable law, a stock exchange, or a regulatory body, provided advance written notice is given where possible.',
      { align: 'justify' }
    );
    addClauseSeparator();

    subClauseNumStyle().text('5.3', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Privacy and Data Protection');
    doc.moveDown(0.5);
    bodyStyle().text(
      'Each party agrees to handle any personal information disclosed under this Agreement in accordance with applicable privacy or data protection laws. Personal information shall only be used for the Purpose and shall not be disclosed to third parties without the prior consent of the individual concerned, except as required by law.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);

    renderSectionHeader('06', 'GENERAL PROVISIONS');

    subClauseNumStyle().text('6.1', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('No Obligation to Proceed');
    doc.moveDown(0.5);
    bodyStyle().text('This Agreement does not obligate either party to enter into any further agreement, share any particular information, or proceed with any business transaction. Each party may discontinue discussions at any time without liability.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.2', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Remedies');
    doc.moveDown(0.5);
    bodyStyle().text('Each party acknowledges that a breach of this Agreement may cause irreparable harm for which monetary damages would be an inadequate remedy. Accordingly, the Disclosing Party shall be entitled to seek equitable relief including injunction and specific performance in addition to all other remedies available at law or in equity, without the requirement to post bond or other security.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.3', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Dispute Resolution');
    doc.moveDown(0.5);
    bodyStyle().text('If a dispute arises in connection with this Agreement, the parties agree to: (a) first attempt to resolve the dispute through good-faith negotiation between senior representatives within fourteen (14) days of written notice of the dispute; and (b) if negotiation fails, refer the dispute to mediation administered by a mutually agreed independent mediator before commencing any legal proceedings. Nothing in this clause prevents either party from seeking urgent interlocutory or injunctive relief from a court of competent jurisdiction.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.4', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Waiver');
    doc.moveDown(0.5);
    bodyStyle().text('No failure or delay by either party in exercising any right or remedy under this Agreement shall operate as a waiver of that right or remedy. A waiver is only effective if given in writing and signed by the waiving party. A waiver of any particular breach does not constitute a waiver of any subsequent breach of the same or any other provision.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.5', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Assignment');
    doc.moveDown(0.5);
    bodyStyle().text('Neither party may assign, transfer, novate, or otherwise deal with any of its rights or obligations under this Agreement without the prior written consent of the other party, which shall not be unreasonably withheld or delayed. Any purported assignment in breach of this clause is void.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.6', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Independent Parties');
    doc.moveDown(0.5);
    bodyStyle().text('The parties are independent contractors. Nothing in this Agreement creates, or shall be construed as creating, any partnership, joint venture, agency, employment, or fiduciary relationship between the parties. Neither party has the authority to bind the other or to incur any obligation on the other\'s behalf.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.7', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Notices');
    doc.moveDown(0.5);
    bodyStyle().text('Any formal notice required or permitted under this Agreement must be in writing and delivered: (a) by email to the address specified in the party details on the cover page (with delivery confirmation); or (b) by registered post or courier to the party\'s nominated address. Email notices are deemed received on the next business day following confirmed delivery.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.8', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Entire Agreement');
    doc.moveDown(0.5);
    bodyStyle().text('This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior and contemporaneous agreements, representations, and understandings whether written or oral. Any amendment must be in writing and signed by authorised representatives of both parties.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.9', { continued: true }); doc.text('      ', { continued: true });
    subClauseHeadingStyle().text('Severability');
    doc.moveDown(0.5);
    bodyStyle().text('If any provision of this Agreement is found to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid provision shall be modified to the minimum extent necessary to make it enforceable.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.10', { continued: true }); doc.text('     ', { continued: true });
    subClauseHeadingStyle().text('Governing Law');
    doc.moveDown(0.5);
    bodyStyle().text('This Agreement shall be governed by and construed in accordance with the laws of United States. The parties irrevocably submit to the exclusive jurisdiction of the courts of that jurisdiction for the resolution of any dispute arising under or in connection with this Agreement.', { align: 'justify' });
    addClauseSeparator();

    subClauseNumStyle().text('6.11', { continued: true }); doc.text('     ', { continued: true });
    subClauseHeadingStyle().text('Counterparts & Electronic Execution');
    doc.moveDown(0.5);
    bodyStyle().text('This Agreement may be executed in counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument. Electronic signatures (including PDF, DocuSign, Adobe Sign, or equivalent) shall be deemed valid, binding, and enforceable for all purposes under applicable law.', { align: 'justify' });
    doc.moveDown(2);
    const requiredHeight = 420;

if (doc.y + requiredHeight > doc.page.height - 80) {
  doc.addPage();
}

renderSectionHeader('07', 'EXECUTION — SIGNATURES');

const execBoxX = 55;
const execBoxY = doc.y;
const execBoxWidth = doc.page.width - 110;
const execBoxHeight = 80;

doc.rect(execBoxX, execBoxY, execBoxWidth, execBoxHeight).fill('#ecf9f7');

doc.rect(execBoxX, execBoxY, execBoxWidth, execBoxHeight)
  .lineWidth(1)
  .strokeColor('#ccece8')
  .stroke();

doc.rect(execBoxX, execBoxY, 4, execBoxHeight).fill('#14b8a6');

doc.fillColor('#444444')
  .fontSize(9.5)
  .lineGap(3);

doc.x = execBoxX + 18;
doc.y = execBoxY + 15;

doc.font('InterBold').text(
  'By signing below, each party agrees to be legally bound by all terms of this Mutual Non-Disclosure Agreement. ',
  {
    width: execBoxWidth - 40,
    continued: true,
  }
);

doc.font('Inter').text(
  'Signatures may be provided electronically or in counterpart originals — both are equally valid.',
  {
    width: execBoxWidth - 40,
    align: 'justify',
  }
);

doc.y = execBoxY + execBoxHeight + 30;

const signatureStartY = doc.y;

const leftX = 55;
const rightX = 320;

const cardWidth = 235;
const titleHeight = 32;

const lineColor = '#8fd7d2';
const headerColor = '#14b8a6';

doc.rect(leftX, signatureStartY, cardWidth, titleHeight)
  .fill(headerColor);

doc.fillColor('#FFFFFF')
  .font('InterBold')
  .fontSize(8.5)
  .text(
    'PARTY A — DEVFORGE TECHNOLOGY',
    leftX + 12,
    signatureStartY + 9,
    {
      width: cardWidth - 20,
    }
  );

let leftY = signatureStartY + 55;

doc.fillColor('#8a8a8a')
  .font('InterItalic')
  .fontSize(7.5);

doc.text('Authorised Signatory', leftX, leftY);

leftY += 28;
doc.strokeColor(lineColor)
  .moveTo(leftX, leftY)
  .lineTo(leftX + cardWidth, leftY)
  .stroke();

leftY += 18;
doc.fillColor('#8a8a8a')
  .font('InterItalic')
  .fontSize(7.5);
doc.text('Full Name', leftX, leftY);

leftY += 28;

doc.strokeColor(lineColor)
  .moveTo(leftX, leftY)
  .lineTo(leftX + cardWidth, leftY)
  .stroke();

doc.font('InterBold')
  .fillColor('#000000')
  .fontSize(7.5)
  .text('Vikram Modh', leftX, leftY - 12);

leftY += 18;
doc.fillColor('#8a8a8a')
  .font('InterItalic')
  .fontSize(7.5);
doc.text('Title / Position', leftX, leftY);

leftY += 28;

doc.strokeColor(lineColor)
  .moveTo(leftX, leftY)
  .lineTo(leftX + cardWidth, leftY)
  .stroke();

doc.font('InterBold')
  .fillColor('#000000')
  .fontSize(7.5)
  .text('Founder & CEO', leftX, leftY - 12);

leftY += 18;
doc.fillColor('#8a8a8a')
  .font('InterItalic')
  .fontSize(7.5);
doc.text('Date', leftX, leftY);

leftY += 28;

doc.strokeColor(lineColor)
  .moveTo(leftX, leftY)
  .lineTo(leftX + cardWidth, leftY)
  .stroke();

doc.font('InterBold')
  .fillColor('#000000')
  .fontSize(7.5)
  .text(`${effectiveDate}`, leftX, leftY - 12);

doc.rect(rightX, signatureStartY, cardWidth, titleHeight)
  .fill(headerColor);

doc.fillColor('#FFFFFF')
  .font('InterBold')
  .fontSize(8.5)
  .text(
    `PARTY B — ${clientName.toUpperCase()}`,
    rightX + 12,
    signatureStartY + 9,
    {
      width: cardWidth - 20,
    }
  );

let rightY = signatureStartY + 55;

doc.fillColor('#8a8a8a')
  .font('InterItalic')
  .fontSize(7.5);

doc.text('Authorised Signatory', rightX, rightY);

rightY += 28;
doc.strokeColor(lineColor)
  .moveTo(rightX, rightY)
  .lineTo(rightX + cardWidth, rightY)
  .stroke();

rightY += 18;
doc.text('Full Name', rightX, rightY);

rightY += 28;
doc.strokeColor(lineColor)
  .moveTo(rightX, rightY)
  .lineTo(rightX + cardWidth, rightY)
  .stroke();

rightY += 18;
doc.text('Title / Position', rightX, rightY);

rightY += 28;
doc.strokeColor(lineColor)
  .moveTo(rightX, rightY)
  .lineTo(rightX + cardWidth, rightY)
  .stroke();

rightY += 18;
doc.text('Date', rightX, rightY);

rightY += 28;
doc.strokeColor(lineColor)
  .moveTo(rightX, rightY)
  .lineTo(rightX + cardWidth, rightY)
  .stroke();

doc.y = Math.max(leftY, rightY) + 35;
doc.x = 55;

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      if (i > 0) {
        doc.font('InterBold').fontSize(10).fillColor('#14b8a6');
        doc.text('DevForge Technology', 55, 35, { align: 'left' });
      }

      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      const footerLineY = pageHeight - 48;
      doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(55, footerLineY).lineTo(pageWidth - 55, footerLineY).stroke();

      doc.font('Inter').fontSize(7.5).fillColor('#444444');
      const footerTextY = pageHeight - 35;

      doc.text('www.trydevforge.com   connect@trydevforge.com   ©2026 DevForge Technology', 55, footerTextY, {
        width: pageWidth - 180,
        align: 'left',
      });

      doc.text(`Page ${i + 1}`, pageWidth - 105, footerTextY, {
        width: 50,
        align: 'right',
      });

      doc.page.margins.bottom = originalBottomMargin;
    }

    doc.end();
    return doc;
  }
}