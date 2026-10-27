import React, { useState, useMemo } from 'react';
import {
  Download,
  Share2,
  FileCheck,
  Calendar,
  AlertCircle,
  Users,
  CheckCircle2,
  Printer
} from 'lucide-react';
import { CreditCard, Person, Transaction } from '../types';
import {
  buildPersonShareData,
  generatePersonSharePdf,
  formatCurrency,
  PersonShareData,
} from '../services/pdfGenerator';

interface MyShareViewProps {
  cards: CreditCard[];
  people: Person[];
  transactions: Transaction[];
}

export const MyShareView: React.FC<MyShareViewProps> = ({
  cards,
  people,
  transactions,
}) => {
  // Selected person in dropdown
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    people[0]?.id || ''
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const selectedPerson = useMemo(() => {
    return people.find((p) => p.id === selectedPersonId) || null;
  }, [people, selectedPersonId]);

  // Compute share data
  const shareData: PersonShareData | null = useMemo(() => {
    if (!selectedPerson) return null;
    return buildPersonShareData(selectedPerson, cards, transactions);
  }, [selectedPerson, cards, transactions]);

  const handleDownloadPdf = () => {
    if (!shareData) return;

    try {
      setIsGeneratingPdf(true);
      const doc = generatePersonSharePdf(shareData);
      const filename = `Expense_Statement_${shareData.person.name.replace(/\s+/g, '_')}_${new Date().toISOString().substring(0, 10)}.pdf`;
      doc.save(filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Error generating PDF statement. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPdf = () => {
    if (!shareData) return;
    try {
      window.print();
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Section: Header & Person Selector */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          {/* Section titles: 20px, Semibold */}
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            My Share · Individual Payment Statement
          </h2>
          {/* Small helper text: 12px, Regular */}
          <p className="text-[12px] font-normal text-slate-500 mt-1">
            Select a person to generate their itemized bill preview, due dates, and downloadable A4 PDF statement.
          </p>
        </div>

        {/* Dropdown to select person */}
        <div className="flex items-center gap-3">
          {/* Labels: 13px, Medium */}
          <label htmlFor="person-select" className="text-[13px] font-medium text-slate-700 whitespace-nowrap">
            Select Person:
          </label>
          <select
            id="person-select"
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className="px-3.5 py-2 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 min-w-[200px]"
          >
            {people.length === 0 && <option value="">No people registered</option>}
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg flex items-center justify-between text-emerald-800 text-[13px] shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">PDF Statement generated and downloaded successfully!</span>
          </div>
          <span className="text-[12px] text-emerald-600 font-normal">A4 Printable Format</span>
        </div>
      )}

      {/* No Person or No Transactions State */}
      {!selectedPerson ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-slate-800">No person selected</h3>
          <p className="text-[13px] font-normal text-slate-500 mt-1">
            Please add or select a person from the dropdown above to view their expense statement.
          </p>
        </div>
      ) : shareData && shareData.cardSummaries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-slate-800">
            No expenses assigned to {selectedPerson.name}
          </h3>
          <p className="text-[13px] font-normal text-slate-500 mt-1 max-w-md mx-auto">
            Go to <strong>Bill Sorting</strong> and assign debit transactions to {selectedPerson.name} in the "Cost To" column.
          </p>
        </div>
      ) : shareData ? (
        <div className="space-y-8">
          {/* Statement Preview Header Banner */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                  Payment Statement Preview
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-[12px] font-normal text-slate-500">
                  {shareData.generationDate}
                </span>
              </div>
              <h3 className="text-[20px] font-semibold text-slate-900 mt-1 tracking-tight">
                {shareData.person.name}
              </h3>
              {shareData.person.phone && (
                <div className="text-[13px] font-normal text-slate-500 mt-0.5">
                  Phone: {shareData.person.phone}
                </div>
              )}
            </div>

            {/* Total Due & PDF Action */}
            <div className="flex items-center gap-4">
              <div className="text-right sm:pr-5 sm:border-r sm:border-slate-200/80">
                <div className="text-[12px] font-medium text-slate-500">Total Payable</div>
                <div className="text-[24px] font-bold text-slate-900 tracking-tight">
                  {formatCurrency(shareData.grandTotal)}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePrintPdf}
                  className="p-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors shadow-2xs"
                  title="Print Preview"
                >
                  <Printer className="w-4 h-4" />
                </button>
                {/* Buttons: 14px, Medium */}
                <button
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>{isGeneratingPdf ? 'Generating...' : 'Generate PDF'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 1: Summary Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200/80 bg-slate-50/60">
              <h4 className="text-[13px] font-semibold text-slate-900 uppercase tracking-wider">
                Summary Table
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  {/* Table headers: 13px, Semibold */}
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-600 font-semibold text-[13px]">
                    <th className="py-3.5 px-4 w-16 text-center font-semibold">Sl No</th>
                    <th className="py-3.5 px-4 font-semibold">Card Name</th>
                    <th className="py-3.5 px-4 font-semibold">Bill Due Date</th>
                    <th className="py-3.5 px-4 font-semibold">You Need To Pay Me On</th>
                    <th className="py-3.5 px-4 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                {/* Body text: 14px, Regular */}
                <tbody className="divide-y divide-slate-100 text-[14px] text-slate-700 font-normal">
                  {shareData.cardSummaries.map((summary) => (
                    <tr key={summary.cardName} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-center text-slate-400 font-normal">
                        {summary.slNo}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {summary.cardName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-normal">
                        {summary.billDueDate}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {summary.payMeOn}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                        {formatCurrency(summary.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold text-slate-900">
                    <td className="py-3.5 px-4 text-center"></td>
                    <td className="py-3.5 px-4 uppercase tracking-wider text-[13px] font-semibold">Total</td>
                    <td className="py-3.5 px-4"></td>
                    <td className="py-3.5 px-4"></td>
                    <td className="py-3.5 px-4 text-right text-[15px] font-bold text-slate-900">
                      {formatCurrency(shareData.grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section 2: Card Wise Transactions */}
          <div className="space-y-6">
            <h4 className="text-[16px] font-semibold text-slate-900 tracking-tight">
              Card Wise Transactions
            </h4>

            {shareData.cardSummaries.map((cardSummary) => (
              <div
                key={cardSummary.cardName}
                className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs"
              >
                {/* Card Subheader */}
                <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-slate-500">Card:</span>
                    <span className="text-[14px] font-semibold text-slate-900">{cardSummary.cardName}</span>
                  </div>
                  <div className="text-[14px] font-semibold text-slate-800">
                    Subtotal: {formatCurrency(cardSummary.amount)}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/40 border-b border-slate-100 text-slate-500 font-semibold text-[13px]">
                        <th className="py-3 px-4 w-14 text-center font-semibold">Sl No</th>
                        <th className="py-3 px-4 w-32 font-semibold">Date</th>
                        <th className="py-3 px-4 font-semibold">Transaction</th>
                        <th className="py-3 px-4 text-right w-40 font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[14px] text-slate-700 font-normal">
                      {cardSummary.transactions.map((tx, idx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/40">
                          <td className="py-3 px-4 text-center text-slate-400 font-normal">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-normal">
                            {tx.date}
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-normal">
                            {tx.description}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-900">
                            {formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50/50 font-medium text-slate-900">
                        <td className="py-3 px-4 text-center"></td>
                        <td className="py-3 px-4"></td>
                        <td className="py-3 px-4 font-semibold text-slate-700 text-[13px]">Card Total</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 text-[14px]">
                          {formatCurrency(cardSummary.amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Action Bar */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <div className="text-[14px] font-semibold text-slate-900">Ready to share?</div>
              <div className="text-[13px] font-normal text-slate-500">
                Click <strong>Generate PDF</strong> to download a clean, professional A4 statement to send to {shareData.person.name}.
              </div>
            </div>

            {/* Buttons: 14px, Medium */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Generate PDF</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
