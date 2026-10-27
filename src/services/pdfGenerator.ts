import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CreditCard, Person, Transaction } from '../types';
import { INTER_REGULAR_B64, INTER_BOLD_B64, INTER_SEMIBOLD_B64 } from './interFonts';

export interface CardSummaryRow {
  slNo: number;
  cardName: string;
  billDueDate: string;
  payMeOn: string;
  amount: number;
  transactions: Transaction[];
}

export interface PersonShareData {
  person: Person;
  cardSummaries: CardSummaryRow[];
  grandTotal: number;
  generationDate: string;
}

/**
 * Calculate "You Need To Pay Me On" (2 days before bill due date)
 */
export function calculatePayMeOnDate(billDueDate: string): string {
  if (!billDueDate) return '2 days before due';

  // Try parsing standard date like "11 Nov 2026" or "2026-11-11"
  const parsedDate = new Date(billDueDate);
  if (!isNaN(parsedDate.getTime()) && billDueDate.length > 5) {
    const payDate = new Date(parsedDate);
    payDate.setDate(payDate.getDate() - 2);
    return payDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // If it's a day number like "11th" or "11"
  const dayMatch = billDueDate.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    const payDay = day > 2 ? day - 2 : (day - 2 + 30);
    const suffix = getNumberSuffix(payDay);
    const monthMatch = billDueDate.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
    const yearMatch = billDueDate.match(/\b(20\d{2})\b/);
    if (monthMatch) {
      return `${String(payDay).padStart(2, '0')} ${monthMatch[1].substring(0, 3)} ${yearMatch ? yearMatch[1] : ''}`.trim();
    }
    return `${payDay}${suffix} of the month`;
  }

  return '2 days before due date';
}

function getNumberSuffix(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Format currency into Indian Rupees style: ₹1,234.56
 */
export function formatCurrency(amount: number): string {
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `₹${formatted}`;
}

/**
 * Prepare card-wise summary and transaction data for a selected person
 */
export function buildPersonShareData(
  person: Person,
  allCards: CreditCard[],
  allTransactions: Transaction[]
): PersonShareData {
  // Filter transactions assigned to this person
  const personTransactions = allTransactions.filter(
    (tx) => tx.cost_to_person_id === person.id
  );

  // Group by card
  const cardMap = new Map<string, Transaction[]>();
  personTransactions.forEach((tx) => {
    const list = cardMap.get(tx.card_id) || [];
    list.push(tx);
    cardMap.set(tx.card_id, list);
  });

  const cardSummaries: CardSummaryRow[] = [];
  let slNo = 1;
  let grandTotal = 0;

  cardMap.forEach((txList, cardId) => {
    const card = allCards.find((c) => c.id === cardId);
    const cardDisplayName = card
      ? `${card.issuer} ${card.card_name}`
      : txList[0]?.card_name || 'Credit Card';
    const billDue = card ? card.bill_due_date : '11th of month';
    const payMeOn = calculatePayMeOnDate(billDue);
    const cardTotal = txList.reduce((sum, item) => sum + item.amount, 0);

    cardSummaries.push({
      slNo: slNo++,
      cardName: cardDisplayName,
      billDueDate: billDue,
      payMeOn: payMeOn,
      amount: cardTotal,
      transactions: txList,
    });

    grandTotal += cardTotal;
  });

  return {
    person,
    cardSummaries,
    grandTotal,
    generationDate: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  };
}

/**
 * Configure and embed Inter fonts into jsPDF instance
 */
function registerInterFonts(doc: jsPDF): void {
  try {
    // Add Inter fonts to Virtual File System
    doc.addFileToVFS('Inter-Regular.ttf', INTER_REGULAR_B64);
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');

    doc.addFileToVFS('Inter-Bold.ttf', INTER_BOLD_B64);
    doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');

    doc.setFont('Inter', 'normal');
  } catch (err) {
    console.warn('Could not register embedded Inter fonts, using default sans fallback', err);
  }
}

/**
 * Generate a premium, professional PDF statement
 * Comparable to Stripe Invoices, Notion, and Zoho Books
 */
export function generatePersonSharePdf(data: PersonShareData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  // Register embedded Inter font family
  registerInterFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32; // 24-32px page margins as requested
  const contentWidth = pageWidth - margin * 2;
  let currentY = 32;

  // Colors according to specification
  const colorPrimary = [17, 24, 39]; // #111827
  const colorSecondary = [107, 114, 128]; // #6B7280
  const colorBorder = [229, 231, 235]; // #E5E7EB
  const colorCardBg = [248, 250, 252]; // #F8FAFC
  const colorHeaderBg = [243, 244, 246]; // #F3F4F6
  const colorAccent = [37, 99, 235]; // #2563EB

  /* ========================================================
     1. HEADER SECTION
  ======================================================== */
  // Logo: Sleek rounded slate mark with 'CS'
  doc.setFillColor(17, 24, 39);
  doc.roundedRect(margin, currentY, 28, 28, 4, 4, 'F');
  doc.setFont('Inter', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('CS', margin + 6, currentY + 18);

  // Brand Name
  doc.setFont('Inter', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('CardSplit', margin + 36, currentY + 19);

  // Right-aligned Date & Reference
  doc.setFont('Inter', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(colorSecondary[0], colorSecondary[1], colorSecondary[2]);
  doc.text(`Date: ${data.generationDate}`, pageWidth - margin, currentY + 14, { align: 'right' });
  doc.text('Status: Verified Debits', pageWidth - margin, currentY + 26, { align: 'right' });

  currentY += 40;

  // Title: 30px Bold (22.5pt)
  doc.setFont('Inter', 'bold');
  doc.setFontSize(22.5); // 30px
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('Credit Card Expense Statement', margin, currentY);

  currentY += 12;

  // Light divider below the header (#E5E7EB)
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.setLineWidth(0.75);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 16;

  /* ========================================================
     2. CUSTOMER INFORMATION CARD
     Display inside a clean rounded card with #F8FAFC background
  ======================================================== */
  const cardHeight = 68;
  doc.setFillColor(colorCardBg[0], colorCardBg[1], colorCardBg[2]);
  doc.roundedRect(margin, currentY, contentWidth, cardHeight, 6, 6, 'F');
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.setLineWidth(0.75);
  doc.roundedRect(margin, currentY, contentWidth, cardHeight, 6, 6, 'S');

  // Customer Details (Left side)
  const leftX = margin + 18;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(colorSecondary[0], colorSecondary[1], colorSecondary[2]);
  doc.text('STATEMENT FOR', leftX, currentY + 18);

  doc.setFont('Inter', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text(data.person.name, leftX, currentY + 34);

  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colorSecondary[0], colorSecondary[1], colorSecondary[2]);
  const phoneText = data.person.phone ? `Phone: ${data.person.phone}` : 'No phone listed';
  const notesText = data.person.notes ? `  |  Note: ${data.person.notes}` : '';
  doc.text(`${phoneText}${notesText}`, leftX, currentY + 50);

  // Total Due (Right side - large, bold, right aligned)
  const rightX = pageWidth - margin - 18;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(colorSecondary[0], colorSecondary[1], colorSecondary[2]);
  doc.text('TOTAL AMOUNT DUE', rightX, currentY + 18, { align: 'right' });

  doc.setFont('Inter', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(colorAccent[0], colorAccent[1], colorAccent[2]);
  doc.text(formatCurrency(data.grandTotal), rightX, currentY + 40, { align: 'right' });

  currentY += cardHeight + 24;

  /* ========================================================
     3. PAYMENT SUMMARY TABLE
     Modern table with light gray header, white rows, zebra striping,
     right-aligned currency, and bold TOTAL row
  ======================================================== */
  // Section heading: 18px Semibold (13.5pt)
  doc.setFont('Inter', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('Payment Summary', margin, currentY);

  currentY += 8;

  const summaryHead = [['Sl No', 'Card Name', 'Bill Due Date', 'You Need To Pay Me On', 'Amount']];
  const summaryBody = data.cardSummaries.map((item) => [
    item.slNo.toString(),
    item.cardName,
    item.billDueDate,
    item.payMeOn,
    formatCurrency(item.amount),
  ]);

  // Bold TOTAL row
  summaryBody.push(['', 'TOTAL', '', '', formatCurrency(data.grandTotal)]);

  autoTable(doc, {
    startY: currentY,
    head: summaryHead,
    body: summaryBody,
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: {
      font: 'Inter',
      fontSize: 9, // Body text: 12px = 9pt
      cellPadding: { top: 7, bottom: 7, left: 10, right: 10 },
      textColor: [17, 24, 39],
      lineColor: [229, 231, 235],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [243, 244, 246], // #F3F4F6
      textColor: [17, 24, 39],
      font: 'Inter',
      fontStyle: 'bold',
      fontSize: 9.75, // Table headers: 13px = ~9.75pt Semibold
      lineColor: [229, 231, 235],
      lineWidth: 0.75,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Zebra striping #F8FAFC
    },
    columnStyles: {
      0: { cellWidth: 44, halign: 'center' },
      1: { cellWidth: 140 },
      2: { cellWidth: 105, halign: 'left' },
      3: { cellWidth: 130, halign: 'left' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (dataCell) => {
      // Highlight TOTAL row
      if (dataCell.row.index === summaryBody.length - 1) {
        dataCell.cell.styles.fontStyle = 'bold';
        dataCell.cell.styles.fillColor = [243, 244, 246];
        dataCell.cell.styles.textColor = [17, 24, 39];
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 28;

  /* ========================================================
     4. TRANSACTION TABLES
     Each card has its own section with subtotal and formatted table
  ======================================================== */
  // Section heading: 18px Semibold (13.5pt)
  if (currentY > pageHeight - 160) {
    doc.addPage();
    currentY = margin;
  }

  doc.setFont('Inter', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('Card-Wise Transaction Details', margin, currentY);

  currentY += 12;

  data.cardSummaries.forEach((cardSummary) => {
    // Check if new page is needed
    if (currentY > pageHeight - 140) {
      doc.addPage();
      currentY = margin;
    }

    // Card Header Bar Box with rounded corners and light borders
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, contentWidth, 24, 4, 4, 'F');
    doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, currentY, contentWidth, 24, 4, 4, 'S');

    doc.setFont('Inter', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    doc.text(`Card: ${cardSummary.cardName}`, margin + 10, currentY + 16);

    doc.setFont('Inter', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colorAccent[0], colorAccent[1], colorAccent[2]);
    doc.text(`Subtotal: ${formatCurrency(cardSummary.amount)}`, pageWidth - margin - 10, currentY + 16, {
      align: 'right',
    });

    currentY += 28;

    const txHead = [['Sl No', 'Date', 'Transaction Details', 'Amount']];
    const txBody = cardSummary.transactions.map((t, idx) => [
      (idx + 1).toString(),
      t.date,
      t.description,
      formatCurrency(t.amount),
    ]);

    // Subtotal Row
    txBody.push(['', '', 'Subtotal', formatCurrency(cardSummary.amount)]);

    autoTable(doc, {
      startY: currentY,
      head: txHead,
      body: txBody,
      theme: 'plain',
      margin: { left: margin, right: margin },
      styles: {
        font: 'Inter',
        fontSize: 9,
        cellPadding: { top: 6, bottom: 6, left: 10, right: 10 },
        textColor: [31, 41, 55],
        lineColor: [243, 244, 246],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [55, 65, 81],
        font: 'Inter',
        fontStyle: 'bold',
        fontSize: 9.75,
        lineColor: [229, 231, 235],
        lineWidth: 0.5,
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: 40, halign: 'center' },
        1: { cellWidth: 85, halign: 'center' }, // Date centered as requested
        2: { cellWidth: 'auto', overflow: 'linebreak' }, // Naturally wraps description
        3: { cellWidth: 100, halign: 'right' }, // Amount right aligned
      },
      didParseCell: (dataCell) => {
        if (dataCell.row.index === txBody.length - 1) {
          dataCell.cell.styles.fontStyle = 'bold';
          dataCell.cell.styles.fillColor = [248, 250, 252];
          dataCell.cell.styles.textColor = [17, 24, 39];
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;
  });

  /* ========================================================
     5. FOOTER SECTION
     Thin divider + small gray text:
     "This statement was automatically generated by CardSplit."
     "Please pay before the mentioned \"Pay Me On\" date."
  ======================================================== */
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footerY = pageHeight - 34;

    // Thin divider
    doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
    doc.setLineWidth(0.75);
    doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

    // Footer text: 10px Regular (7.5pt)
    doc.setFont('Inter', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(colorSecondary[0], colorSecondary[1], colorSecondary[2]);
    doc.text('This statement was automatically generated by CardSplit.', margin, footerY);
    doc.text('Please pay before the mentioned "Pay Me On" date.', margin, footerY + 10);

    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footerY + 5, { align: 'right' });
  }

  return doc;
}
