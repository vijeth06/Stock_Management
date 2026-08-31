const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// ===========================================================================
// Layout Constants — A4 portrait with professional college document margins
// All measurements in points (1 inch = 72 points, 1 mm = 2.8346 points)
// ===========================================================================
const PAGE_WIDTH = 595;   // A4 width
const PAGE_HEIGHT = 842;  // A4 height
const MARGIN_LEFT = 55;   // ~20mm
const MARGIN_RIGHT = 55;  // ~20mm
const MARGIN_TOP = 60;    // ~25mm (first page has header)
const MARGIN_BOTTOM = 60; // ~25mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const PRINTABLE_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM;

const COLORS = {
  primary: "#1e3a8a",        // Deep blue for headers and accents
  primaryDark: "#152c5a",    // Darker blue for important values
  secondary: "#0f172a",      // Near-black for body text
  text: "#111827",           // Primary text
  muted: "#6b7280",          // Gray for secondary labels
  border: "#9ca3af",         // Light gray for table borders
  borderLight: "#d1d5db",    // Very light border
  headerBg: "#1e3a8a",       // Blue header background
  headerText: "#ffffff",     // White text in headers
  tableHeaderBg: "#f3f4f6",  // Gray header for tables
  tableHeaderText: "#1f2937",
  altRow: "#f9fafb",         // Alternating row background
  footerBg: "#f9fafb",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
};

// ===========================================================================
// Formatting Helpers
// ===========================================================================

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr || Date.now());
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

function formatDateDDMMYYYY(dateStr) {
  try {
    const d = new Date(dateStr || Date.now());
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return "N/A";
  }
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  if (num === 0) return "INR 0.00";
  return `INR ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeValue(val, fallback = "N/A") {
  if (val === undefined || val === null || val === "") return fallback;
  return String(val);
}

function safeNumber(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// ===========================================================================
// Page Setup & Footer Helper
// ===========================================================================

function initPage(doc, pageNumber) {
  addFooter(doc, pageNumber);
}

function addFooter(doc, pageNumber) {
  const origY = doc.y;
  const footerTop = PAGE_HEIGHT - MARGIN_BOTTOM + 12;

  // Footer separator line
  doc
    .moveTo(MARGIN_LEFT, footerTop - 4)
    .lineTo(PAGE_WIDTH - MARGIN_RIGHT, footerTop - 4)
    .strokeColor(COLORS.borderLight)
    .lineWidth(0.5)
    .stroke();

  doc
    .fillColor(COLORS.muted)
    .fontSize(7.5)
    .font("Helvetica-Oblique")
    .text("ChainTrack Asset Management System", MARGIN_LEFT, footerTop);

  doc
    .fillColor(COLORS.muted)
    .fontSize(7.5)
    .font("Helvetica")
    .text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN_RIGHT - 30, footerTop, { align: "right" });

  doc.y = origY;
}

// ===========================================================================
// Header Helper — College/department banner
// ===========================================================================

function drawHeader(doc, collegeName, deptName, reportTitle, subtitle, financialYear) {
  let y = MARGIN_TOP;

  // Top rule line
  doc
    .moveTo(MARGIN_LEFT, y)
    .lineTo(PAGE_WIDTH - MARGIN_RIGHT, y)
    .strokeColor(COLORS.primary)
    .lineWidth(1)
    .stroke();
  y += 4;

  doc
    .fillColor(COLORS.primary)
    .fontSize(15)
    .font("Helvetica-Bold")
    .text(collegeName, MARGIN_LEFT, y, { align: "center" });
  y += 18;

  if (deptName) {
    doc
      .fillColor(COLORS.primaryDark)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(deptName, MARGIN_LEFT, y, { align: "center" });
    y += 15;
  }

  // Report title — centered, bold, large
  doc
    .fillColor(COLORS.secondary)
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(reportTitle, MARGIN_LEFT, y, { align: "center" });
  y += 18;

  if (financialYear) {
    doc
      .fillColor(COLORS.muted)
      .fontSize(10)
      .font("Helvetica-Oblique")
      .text(`Financial Year: ${financialYear}`, MARGIN_LEFT, y, { align: "center" });
    y += 14;
  }

  if (subtitle) {
    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .font("Helvetica")
      .text(subtitle, MARGIN_LEFT, y, { align: "center" });
    y += 16;
  }

  // Bottom separator line
  doc
    .moveTo(MARGIN_LEFT, y)
    .lineTo(PAGE_WIDTH - MARGIN_RIGHT, y)
    .strokeColor(COLORS.borderLight)
    .lineWidth(0.5)
    .stroke();
  y += 12;

  return y;
}

// ===========================================================================
// Section Heading Helper
// ===========================================================================

function sectionHeading(doc, text, number) {
  const label = number ? `${number}. ${text}` : text;
  const fullWidth = doc.widthOfString(label, { fontSize: 12 });
  const boxWidth = Math.max(fullWidth + 16, 120);

  const startX = MARGIN_LEFT;
  const startY = doc.y + 4;

  doc
    .fillColor(COLORS.primary)
    .rect(startX, startY, boxWidth, 16)
    .fill(COLORS.primary);

  doc
    .fillColor(COLORS.headerText)
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(label, startX + 8, startY + 3);

  doc.moveDown(1);
}

// ===========================================================================
// Metadata Grid Helper — two-column label:value layout
// ===========================================================================

function drawMetaGrid(doc, labelValuePairs, startY, labelWidth = 160, valueXOffset = 170) {
  let y = startY;
  const lineHeight = 14;
  const itemsPerCol = Math.ceil(labelValuePairs.length / 2);

  doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica");

  labelValuePairs.forEach((pair, idx) => {
    const col = idx < itemsPerCol ? 0 : 1;
    const row = col === 0 ? idx : idx - itemsPerCol;
    const x = MARGIN_LEFT + col * (CONTENT_WIDTH / 2);

    doc.fillColor(COLORS.secondary).font("Helvetica-Bold");
    doc.text(`${pair[0]}:`, x, y + row * lineHeight);
    doc.fillColor(COLORS.text).font("Helvetica");
    doc.text(safeValue(pair[1]), x + valueXOffset, y + row * lineHeight);
  });

  return y + itemsPerCol * lineHeight + 6;
}

// ===========================================================================
// KPI Summary Cards Helper
// ===========================================================================

function drawKpis(doc, kpis, columns = 3) {
  const rowHeight = 22;
  const gap = 6;
  const totalGap = (columns - 1) * gap;
  const badgeWidth = Math.floor((CONTENT_WIDTH - totalGap) / columns);
  const startY = doc.y;

  kpis.forEach((kpi, idx) => {
    const col = idx % columns;
    const row = Math.floor(idx / columns);
    const x = MARGIN_LEFT + col * (badgeWidth + gap);
    const y = startY + row * (rowHeight + gap);

    // Card background with border
    doc
      .rect(x, y, badgeWidth, rowHeight)
      .fill(COLORS.footerBg)
      .stroke(COLORS.borderLight);

    // Label
    doc
      .fillColor(COLORS.muted)
      .fontSize(7)
      .font("Helvetica-Oblique")
      .text(kpi.label, x + 5, y + 3, { width: badgeWidth - 10, align: "center" });

    // Value
    doc
      .fillColor(COLORS.primaryDark)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(kpi.value, x + 5, y + 10, { width: badgeWidth - 10, align: "center" });
  });

  doc.y = startY + Math.floor((kpis.length - 1) / columns) * (rowHeight + gap) + rowHeight + gap;
}

// ===========================================================================
// Table Helper — robust table with header repetition across pages
// ===========================================================================

function drawTable(doc, headers, rows, startY, colWidths, options = {}) {
  const fontSize = options.fontSize || 8;
  const rowHeight = options.rowHeight || 18;
  const headerHeight = 20;
  const font = options.font || "Helvetica";
  const alignMap = options.align || {};

  let docY = startY;
  const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = MARGIN_LEFT + Math.max(0, Math.floor((CONTENT_WIDTH - totalTableWidth) / 2));

  function renderHeader() {
    doc
      .rect(startX, docY, totalTableWidth, headerHeight)
      .fill(COLORS.primary);

    doc
      .fillColor(COLORS.headerText)
      .fontSize(fontSize)
      .font("Helvetica-Bold");

    let cx = startX;
    headers.forEach((h, i) => {
      doc.text(h, cx, docY + 5, {
        width: colWidths[i] - 1,
        align: "center",
        valign: "center",
      });
      cx += colWidths[i];
    });

    docY += headerHeight;
  }

  renderHeader();

  rows.forEach((row, ri) => {
    const rowY = docY;

    // Page break check — if the row won't fit, start a new page and repeat header
    if (rowY + rowHeight > PRINTABLE_BOTTOM) {
      doc.addPage();
      docY = MARGIN_TOP;
      initPage(doc, doc.bufferedPageRange().start + 2);
      renderHeader();
    }

    // Alternating row background
    if (ri % 2 === 0) {
      doc
        .rect(startX, docY, totalTableWidth, rowHeight)
        .fill(COLORS.altRow);
    }

    // Cell borders
    doc
      .rect(startX, docY, totalTableWidth, rowHeight)
      .strokeColor(COLORS.borderLight)
      .lineWidth(0.25)
      .stroke();

    doc
      .fillColor(COLORS.text)
      .fontSize(fontSize)
      .font(font);

    let tx = startX;
    row.forEach((cell, ci) => {
      const align = alignMap[ci] || "left";
      doc.text(String(cell), tx, docY + 3, {
        width: colWidths[ci] - 2,
        align: align,
      });
      tx += colWidths[ci];
    });

    docY += rowHeight;
  });

  // Bottom border
  doc
    .moveTo(startX, docY)
    .lineTo(startX + totalTableWidth, docY)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();

  return docY + 12;
}

// ===========================================================================
// Table Helper — 3-column wide summary table with header repetition
// ===========================================================================

function drawWideSummaryTable(doc, headers, colWidths, rows, startY, fontSize = 8, rowHeight = 18) {
  let docY = startY;
  const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = MARGIN_LEFT;

  function renderHeader() {
    doc
      .rect(startX, docY, totalTableWidth, rowHeight)
      .fill(COLORS.primary);

    doc
      .fillColor(COLORS.headerText)
      .fontSize(fontSize)
      .font("Helvetica-Bold");

    let cx = startX;
    headers.forEach((h, i) => {
      doc.text(h, cx, docY + 4, { width: colWidths[i] - 2, align: "left" });
      cx += colWidths[i];
    });

    docY += rowHeight;
  }

  renderHeader();

  rows.forEach((row, ri) => {
    const rowY = docY;

    if (rowY + rowHeight > PRINTABLE_BOTTOM) {
      doc.addPage();
      docY = MARGIN_TOP;
      initPage(doc, doc.bufferedPageRange().start + 2);
      renderHeader();
    }

    if (ri % 2 === 0) {
      doc
        .rect(startX, rowY, totalTableWidth, rowHeight)
        .fill(COLORS.altRow);
    }

    doc
      .rect(startX, rowY, totalTableWidth, rowHeight)
      .strokeColor(COLORS.borderLight)
      .lineWidth(0.25)
      .stroke();

    doc
      .fillColor(COLORS.text)
      .fontSize(fontSize)
      .font("Helvetica");

    let cx = startX;
    row.forEach((cell, ci) => {
      doc.text(String(cell), cx, rowY + 3, { width: colWidths[ci] - 2, align: "left" });
      cx += colWidths[ci];
    });

    docY += rowHeight;
  });

  doc
    .moveTo(startX, docY)
    .lineTo(startX + totalTableWidth, docY)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();

  return docY + 12;
}

// ===========================================================================
// Ensure Space Helper — adds page break if needed
// ===========================================================================

function ensureSpace(doc, needed) {
  if (doc.y + needed > PRINTABLE_BOTTOM) {
    doc.addPage();
    const newPageNum = doc.bufferedPageRange().start + 2;
    initPage(doc, newPageNum);
    doc.y = MARGIN_TOP;
    return doc.y;
  }
  return doc.y;
}

// ===========================================================================
// Signature Area Helper — 3-column signature block
// ===========================================================================

function drawSignatures(doc, signers) {
  ensureSpace(doc, 55);
  doc.moveDown(0.3);

  const boxWidth = CONTENT_WIDTH / signers.length;
  const boxY = doc.y;
  const boxHeight = 50;

  // Box outline
  doc
    .rect(MARGIN_LEFT, boxY, CONTENT_WIDTH, boxHeight)
    .fillAndStroke(COLORS.footerBg, COLORS.borderLight);

  signers.forEach((signer, idx) => {
    const x = MARGIN_LEFT + idx * boxWidth;

    if (idx > 0) {
      // Vertical divider
      doc
        .moveTo(x, boxY + 5)
        .lineTo(x, boxY + boxHeight - 5)
        .strokeColor(COLORS.borderLight)
        .lineWidth(0.5)
        .stroke();
    }

    doc
      .fillColor(COLORS.secondary)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text(signer.title, x + 8, boxY + 6, { width: boxWidth - 16, align: "center" });

    doc
      .fillColor(COLORS.text)
      .fontSize(6.5)
      .font("Helvetica")
      .text("Name: " + safeValue(signer.name, ""), x + 8, boxY + 18, { width: boxWidth - 16, align: "center" });

    doc
      .fillColor(COLORS.text)
      .fontSize(6.5)
      .font("Helvetica")
      .text("Date: " + formatDateDDMMYYYY(signer.date), x + 8, boxY + 28, { width: boxWidth - 16, align: "center" });

    doc
      .fillColor(COLORS.text)
      .fontSize(11)
      .font("Helvetica")
      .text("__________________", x + 8, boxY + 38, { width: boxWidth - 16, align: "center" });
  });

  return boxY + boxHeight + 10;
}

// ===========================================================================
// Generate Annual Audit Report PDF
// ===========================================================================

async function generatePdfBuffer(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      initPage(doc, pageNumber);

      // ==============================
      // Cover Page
      // ==============================
      drawHeader(
        doc,
        "KONGU ENGINEERING COLLEGE",
        "",
        "ANNUAL ASSET AUDIT & INVENTORY REPORT",
        "",
        reportData.year || new Date().getFullYear()
      );

      let y = doc.y + 10;

      // Report Info section
      doc
        .fillColor(COLORS.secondary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Report Information", MARGIN_LEFT, y);
      y += 18;

      const infoPairs = [
        ["Report ID", reportData.reportId || `REP-${reportData.year}`],
        ["Audit Officer", reportData.auditOfficer || "Administrator"],
        ["Audit Period", reportData.auditPeriod || `FY ${reportData.year || new Date().getFullYear()}`],
        ["Report Date", formatDateDDMMYYYY(reportData.auditDate || reportData.generatedAt)],
        ["Generated At", formatDate(reportData.generatedAt)],
      ];
      y = drawMetaGrid(doc, infoPairs, y);

      // Blockchain verification note
      doc
        .fillColor(COLORS.muted)
        .fontSize(8)
        .font("Helvetica-Oblique")
        .text("This report is generated from data recorded on the Hyperledger Fabric blockchain ledger.",
          MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: "center" });
      y += 16;

      // Executive Summary
      sectionHeading(doc, "Executive Asset Summary", 1);

      const kpis = [
        { label: "Total Asset Count", value: String(reportData.totalAssets || 0) },
        { label: "Portfolio Value", value: formatCurrency(reportData.totalPurchaseValue || 0) },
        { label: "Active Assets", value: String(reportData.activeAssets || 0) },
        { label: "Under Maintenance", value: String(reportData.maintenanceAssets || 0) },
        { label: "Condemned Assets", value: String(reportData.condemnedAssets || 0) },
        { label: "Disposed / Retired", value: String(reportData.disposedAssets || 0) },
      ];
      drawKpis(doc, kpis, 3);

      // Department Breakdown
      sectionHeading(doc, "Departmental Breakdown", 2);
      const deptSummary = reportData.departmentSummary || {};
      const deptKeys = Object.keys(deptSummary);

      if (deptKeys.length === 0) {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No department summary available", MARGIN_LEFT, doc.y);
        doc.moveDown(0.8);
      } else {
        const deptHeaders = ["Department", "Asset Count", "Total Value (INR)"];
        const deptColWidths = [Math.floor(CONTENT_WIDTH * 0.45), Math.floor(CONTENT_WIDTH * 0.25), CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.45) - Math.floor(CONTENT_WIDTH * 0.25)];
        const deptRows = deptKeys.map((dept) => {
          const item = typeof deptSummary[dept] === "object"
            ? deptSummary[dept]
            : { totalAssets: deptSummary[dept], totalPurchaseValue: 0 };
          return [
            safeValue(dept),
            String(item.totalAssets || item.count || 0),
            formatCurrency(item.totalPurchaseValue || item.totalValue || 0),
          ];
        });
        y = drawWideSummaryTable(doc, deptHeaders, deptColWidths, deptRows, doc.y);
      }

      // Category Breakdown
      sectionHeading(doc, "Category Summary", 3);

      // Build category totals from assetsList for correct value mapping
      const catValueMap = {};
      if (Array.isArray(reportData.assetsList)) {
        reportData.assetsList.forEach(a => {
          const cat = a.category || "Unknown";
          if (!catValueMap[cat]) catValueMap[cat] = { count: 0, value: 0 };
          catValueMap[cat].count += 1;
          catValueMap[cat].value += Number(a.purchaseValue) || 0;
        });
      }
      // Merge with provided categorySummary (which may have counts from blockchain)
      const catSummary = reportData.categorySummary || {};
      const catKeys = Object.keys(catValueMap).length > 0
        ? Object.keys(catValueMap)
        : Object.keys(catSummary);

      if (catKeys.length === 0) {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No category summary available", MARGIN_LEFT, doc.y);
        doc.moveDown(0.8);
      } else {
        const catHeaders = ["Category", "Asset Count", "Total Value (INR)"];
        const catColWidths = [Math.floor(CONTENT_WIDTH * 0.45), Math.floor(CONTENT_WIDTH * 0.25), CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.45) - Math.floor(CONTENT_WIDTH * 0.25)];
        const catRows = catKeys.map((cat) => {
          let count = 0;
          let value = 0;
          if (catValueMap[cat]) {
            count = catValueMap[cat].count;
            value = catValueMap[cat].value;
          } else {
            const item = typeof catSummary[cat] === "object"
              ? catSummary[cat]
              : { totalAssets: catSummary[cat], totalPurchaseValue: 0 };
            count = item.totalAssets || item.count || 0;
            value = item.totalPurchaseValue || item.totalValue || 0;
          }
          return [
            safeValue(cat),
            String(count),
            formatCurrency(value),
          ];
        });
        y = drawWideSummaryTable(doc, catHeaders, catColWidths, catRows, doc.y);
      }

      // Valuation Summary
      sectionHeading(doc, "Department Valuation Summary", 4);
      const valuation = reportData.valuationData || {};
      const valKeys = Object.keys(valuation);

      if (valKeys.length === 0) {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No valuation data available", MARGIN_LEFT, doc.y);
        doc.moveDown(0.8);
      } else {
        const valHeaders = ["Department", "Total Assets", "Total Value (INR)", "Net Book Value (INR)"];
        const valColWidths = [Math.floor(CONTENT_WIDTH * 0.35), Math.floor(CONTENT_WIDTH * 0.18), Math.floor(CONTENT_WIDTH * 0.23), CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.35) - Math.floor(CONTENT_WIDTH * 0.18) - Math.floor(CONTENT_WIDTH * 0.23)];
        const valRows = valKeys.map((key) => {
          const v = valuation[key] || {};
          return [
            safeValue(v.name || key),
            String(v.totalAssets || 0),
            formatCurrency(v.totalPurchaseValue || 0),
            formatCurrency(v.netBookValue || 0),
          ];
        });
        drawWideSummaryTable(doc, valHeaders, valColWidths, valRows, doc.y);
      }

      // Financial Summary
      sectionHeading(doc, "Financial / Bills Summary", 5);
      const finPairs = [
        ["Total Bills", String(reportData.totalBills || 0)],
        ["Total Bill Value", formatCurrency(reportData.totalBillValue || 0)],
        ["Total Maintenance Records", String(reportData.totalMaintenance || 0)],
        ["Total Maintenance Cost", formatCurrency(reportData.totalMaintenanceCost || 0)],
        ["Total Transfers", String(reportData.totalTransfers || 0)],
        ["Total Consumables Tracked", String((reportData.consumablesList || []).length)],
      ];
      y = drawMetaGrid(doc, finPairs, doc.y);

      // Maintenance Summary
      sectionHeading(doc, "Maintenance Summary", 6);
      const mntSummaryPairs = [
        ["Total Maintenance Records", String(reportData.totalMaintenance || 0)],
        ["Total Maintenance Cost", formatCurrency(reportData.totalMaintenanceCost || 0)],
      ];
      drawMetaGrid(doc, mntSummaryPairs, doc.y);

      // Transfers Summary
      sectionHeading(doc, "Transfers Summary", 7);
      doc
        .fillColor(COLORS.secondary).fontSize(10).font("Helvetica-Bold")
        .text("Total Transfers:", MARGIN_LEFT, doc.y);
      doc.fillColor(COLORS.primaryDark).fontSize(10).font("Helvetica-Bold")
        .text(String(reportData.totalTransfers || 0), MARGIN_LEFT + 80, doc.y);
      doc.moveDown(0.8);

      // Important Totals — highlighted
      const totals = [
        { label: "Total Assets", value: String(reportData.totalAssets || 0) },
        { label: "Total Portfolio Value", value: formatCurrency(reportData.totalPurchaseValue || 0) },
        { label: "Total Bill Value", value: formatCurrency(reportData.totalBillValue || 0) },
        { label: "Total Maintenance Cost", value: formatCurrency(reportData.totalMaintenanceCost || 0) },
      ];
      drawKpis(doc, totals, 2);

      // Signatures
      const auditDate = formatDateDDMMYYYY(reportData.auditDate || reportData.generatedAt);
      drawSignatures(doc, [
        { title: "Prepared By", name: reportData.auditOfficer || "Audit Officer", date: auditDate },
        { title: "Verified By", name: reportData.auditOfficer || "Audit Officer", date: auditDate },
        { title: "Approved By", name: "Department Head", date: auditDate },
      ]);

      // ==============================
      // Detail Tables (subsequent pages)
      // ==============================

      // Detailed Asset Table
      if (Array.isArray(reportData.assetsList) && reportData.assetsList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        initPage(doc, pageNumber);

        drawHeader(doc, "KONGU ENGINEERING COLLEGE", "", "ASSET REGISTRY DETAILS",
          `Report: ${reportData.reportId || ""}`, reportData.year || new Date().getFullYear());

        const assetHeaders = ["Asset ID", "Name", "Department", "Category", "Status", "Purchase Value (INR)"];
        const assetColWidths = [75, 125, 75, 70, 65, 75];
        const assetRows = reportData.assetsList.map((ast) => [
          safeValue(ast.assetId),
          safeValue(ast.name),
          safeValue(ast.department),
          safeValue(ast.category),
          safeValue(ast.status),
          formatCurrency(ast.purchaseValue || 0),
        ]);
        drawTable(doc, assetHeaders, assetRows, doc.y, assetColWidths, { fontSize: 8, rowHeight: 18 });
      }

      // Maintenance Detail Table
      if (Array.isArray(reportData.maintenanceList) && reportData.maintenanceList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        initPage(doc, pageNumber);

        drawHeader(doc, "KONGU ENGINEERING COLLEGE", "", "MAINTENANCE RECORDS",
          `Report: ${reportData.reportId || ""}`, reportData.year || new Date().getFullYear());

        const mntHeaders = ["Record ID", "Asset ID", "Technician", "Date", "Cost (INR)", "Status", "Description"];
        const mntColWidths = [75, 75, 65, 65, 55, 55, 140];
        const mntRows = reportData.maintenanceList.map((m) => [
          safeValue(m.recordId || m.id),
          safeValue(m.assetId),
          safeValue(m.technician),
          formatDateDDMMYYYY(m.maintenanceDate || m.createdAt),
          formatCurrency(m.cost || 0),
          safeValue(m.status || "Completed"),
          safeValue(m.description),
        ]);
        drawTable(doc, mntHeaders, mntRows, doc.y, mntColWidths, { fontSize: 7, rowHeight: 18 });
      }

      // Bills Detail Table
      if (Array.isArray(reportData.billsList) && reportData.billsList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        initPage(doc, pageNumber);

        drawHeader(doc, "KONGU ENGINEERING COLLEGE", "", "BILLS / PURCHASE RECORDS",
          `Report: ${reportData.reportId || ""}`, reportData.year || new Date().getFullYear());

        const billHeaders = ["Bill ID", "Asset ID", "Vendor", "Invoice", "Amount (INR)", "Status"];
        const billColWidths = [75, 75, 100, 75, 60, 55];
        const billRows = reportData.billsList.map((bill) => [
          safeValue(bill.billId || bill.id),
          safeValue(bill.assetId),
          safeValue(bill.vendor),
          safeValue(bill.invoiceNumber),
          formatCurrency(bill.amount || 0),
          safeValue(bill.paymentStatus || "Paid"),
        ]);
        drawTable(doc, billHeaders, billRows, doc.y, billColWidths, { fontSize: 7, rowHeight: 18 });
      }

      // Transfers Detail Table
      if (Array.isArray(reportData.transfersList) && reportData.transfersList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        initPage(doc, pageNumber);

        drawHeader(doc, "KONGU ENGINEERING COLLEGE", "", "ASSET TRANSFERS",
          `Report: ${reportData.reportId || ""}`, reportData.year || new Date().getFullYear());

        const trHeaders = ["Transfer ID", "Asset ID", "From Dept", "To Dept", "Date", "Status"];
        const trColWidths = [85, 75, 70, 70, 70, 55];
        const trRows = reportData.transfersList.map((tr) => [
          safeValue(tr.transferId),
          safeValue(tr.assetId),
          safeValue(tr.fromDepartment),
          safeValue(tr.toDepartment),
          formatDateDDMMYYYY(tr.date || tr.createdAt),
          safeValue(tr.status || "Completed"),
        ]);
        drawTable(doc, trHeaders, trRows, doc.y, trColWidths, { fontSize: 7, rowHeight: 18 });
      }

      // Consumables Detail Table
      if (Array.isArray(reportData.consumablesList) && reportData.consumablesList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        initPage(doc, pageNumber);

        drawHeader(doc, "KONGU ENGINEERING COLLEGE", "", "CONSUMABLES INVENTORY",
          `Report: ${reportData.reportId || ""}`, reportData.year || new Date().getFullYear());

        const consHeaders = ["Consumable ID", "Name", "Department", "Unit", "Current Stock", "Purchase Value (INR)", "Location"];
        const consColWidths = [70, 90, 65, 45, 55, 65, 70];
        const consRows = reportData.consumablesList.map((c) => [
          safeValue(c.consumableId),
          safeValue(c.name),
          safeValue(c.department),
          safeValue(c.unit),
          safeValue(c.currentStock !== undefined ? c.currentStock : ""),
          formatCurrency(c.purchaseValue || 0),
          safeValue(c.location),
        ]);
        drawTable(doc, consHeaders, consRows, doc.y, consColWidths, { fontSize: 7, rowHeight: 18 });
      }

      // Condemnation Records Table
      if (Array.isArray(reportData.condemnationList) && reportData.condemnationList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        initPage(doc, pageNumber);

        drawHeader(doc, "KONGU ENGINEERING COLLEGE", "", "CONDEMNATION RECORDS",
          `Report: ${reportData.reportId || ""}`, reportData.year || new Date().getFullYear());

        const condHeaders = ["Record ID", "Asset ID", "Department", "Reason", "Status", "Requested By", "Created At"];
        const condColWidths = [65, 65, 55, 100, 55, 65, 65];
        const condRows = reportData.condemnationList.map((c) => [
          safeValue(c.recordId || c.id),
          safeValue(c.assetId),
          safeValue(c.department),
          safeValue(c.reason),
          safeValue(c.status || "Pending"),
          safeValue(c.requestedBy),
          formatDateDDMMYYYY(c.createdAt || c.requestedAt),
        ]);
        drawTable(doc, condHeaders, condRows, doc.y, condColWidths, { fontSize: 6, rowHeight: 18 });
      }

      // Blockchain verification footer note on last page
      doc.moveDown(0.5);
      doc
        .fillColor(COLORS.muted)
        .fontSize(7)
        .font("Helvetica-Oblique")
        .text("Document generated from Hyperledger Fabric blockchain ledger. All data is cryptographically verified and immutable.",
          MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================================================================
// Generate Department Valuation Report PDF
// ===========================================================================

async function generateValuationPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      initPage(doc, pageNumber);

      drawHeader(
        doc,
        "KONGU ENGINEERING COLLEGE",
        "",
        "DEPARTMENTAL VALUATION REPORT",
        "",
        data.financialYear || new Date().getFullYear()
      );

      let y = doc.y + 10;

      sectionHeading(doc, "Report Information", 1);
      const infoPairs = [
        ["Report Date", formatDateDDMMYYYY(data.generatedAt || new Date())],
        ["Financial Year", data.financialYear || new Date().getFullYear()],
        ["Total Departments", String(data.departmentCount || 0)],
        ["Total Assets", String(data.totalAssets || 0)],
        ["Total Portfolio Value", formatCurrency(data.totalPurchaseValue || 0)],
        ["Total Net Book Value", formatCurrency(data.netBookValue || 0)],
      ];
      y = drawMetaGrid(doc, infoPairs, y);

      // KPIs
      sectionHeading(doc, "Key Metrics", 2);
      const kpis = [
        { label: "Total Purchase Value", value: formatCurrency(data.totalPurchaseValue || 0) },
        { label: "Net Book Value", value: formatCurrency(data.netBookValue || 0) },
        { label: "Total Depreciation", value: formatCurrency((data.totalPurchaseValue || 0) - (data.netBookValue || 0)) },
        { label: "Avg Depreciation %", value: data.totalPurchaseValue ? `${Math.round(((1 - data.netBookValue / data.totalPurchaseValue) * 100))}%` : "0%" },
        { label: "Total Departments", value: String(data.departmentCount || 0) },
        { label: "Total Assets", value: String(data.totalAssets || 0) },
      ];
      drawKpis(doc, kpis, 3);

      // Department-wise valuation table
      sectionHeading(doc, "Department-wise Valuation", 3);
      const valuationData = Array.isArray(data.departments) ? data.departments : [];
      if (valuationData.length > 0) {
        const headers = ["Department", "Code", "Total Assets", "Purchase Value (INR)", "Net Book Value (INR)", "Active", "Maintenance", "Condemned", "Disposed"];
        const colWidths = [55, 45, 45, 65, 65, 50, 55, 55, 50];
        const totalW = colWidths.reduce((a, b) => a + b, 0);
        const startX = MARGIN_LEFT + Math.max(0, Math.floor((CONTENT_WIDTH - totalW) / 2));

        let docY = doc.y;
        const headerHeight = 20;
        doc.rect(startX, docY, totalW, headerHeight).fill(COLORS.primary);
        doc.fillColor(COLORS.headerText).fontSize(6).font("Helvetica-Bold");
        let cx = startX;
        headers.forEach((h, i) => {
          doc.text(h, cx, docY + 4, { width: colWidths[i] - 2, align: "center" });
          cx += colWidths[i];
        });
        docY += headerHeight;

        const rowHeight = 16;
        doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
        valuationData.forEach((dept, idx) => {
          const rowY = docY;
          if (rowY + rowHeight > PRINTABLE_BOTTOM) {
            doc.addPage();
            pageNumber += 1;
            initPage(doc, pageNumber);
            docY = MARGIN_TOP;
            doc.rect(startX, docY, totalW, headerHeight).fill(COLORS.primary);
            doc.fillColor(COLORS.headerText).fontSize(6).font("Helvetica-Bold");
            let hx = startX;
            headers.forEach((h, i) => {
              doc.text(h, hx, docY + 4, { width: colWidths[i] - 2, align: "center" });
              hx += colWidths[i];
            });
            docY += headerHeight;
            doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
          }

          if (idx % 2 === 0) {
            doc.rect(startX, docY, totalW, rowHeight).fill(COLORS.altRow);
          }
          doc.rect(startX, docY, totalW, rowHeight).strokeColor(COLORS.borderLight).lineWidth(0.25).stroke();
          doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");

          const values = [
            safeValue(dept.name || dept.department || ""),
            safeValue(dept.code || ""),
            String(dept.totalAssets || 0),
            formatCurrency(dept.totalPurchaseValue || 0),
            formatCurrency(dept.netBookValue || 0),
            String(dept.activeAssets || 0),
            String(dept.maintenanceAssets || 0),
            String(dept.condemnedAssets || 0),
            String(dept.disposedAssets || 0),
          ];

          const alignMap = {
            2: "right", 3: "right", 4: "right",
            5: "center", 6: "center", 7: "center", 8: "center"
          };
          let tx = startX;
          values.forEach((val, i) => {
            doc.text(val, tx, docY + 3, { width: colWidths[i] - 2, align: alignMap[i] || "left" });
            tx += colWidths[i];
          });

          docY += rowHeight;
        });
        y = docY + 15;
      }

      // Summary table
      sectionHeading(doc, "Portfolio Summary", 4);
      const summaryHeaders = ["Metric", "Amount (INR)"];
      const summaryColWidths = [Math.floor(CONTENT_WIDTH * 0.4), CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.4)];
      const summaryRows = [
        ["Total Purchase Value", formatCurrency(data.totalPurchaseValue || 0)],
        ["Total Net Book Value", formatCurrency(data.netBookValue || 0)],
        ["Total Depreciation", formatCurrency((data.totalPurchaseValue || 0) - (data.netBookValue || 0))],
        ["Number of Departments", String(data.departmentCount || 0)],
        ["Number of Assets", String(data.totalAssets || 0)],
      ];
      drawWideSummaryTable(doc, summaryHeaders, summaryColWidths, summaryRows, doc.y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================================================================
// Generate Department Valuation Report Excel
// ===========================================================================

async function generateValuationExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Department Valuation');
  sheet.columns = [
    { header: 'Field', key: 'field', width: 35 },
    { header: 'Value', key: 'value', width: 50 }
  ];
  sheet.getRow(1).font = { bold: true };

  const rows = [
    { field: 'Report Date', value: data.generatedAt || new Date().toISOString() },
    { field: 'Financial Year', value: data.financialYear || new Date().getFullYear() },
    { field: 'Total Departments', value: data.departmentCount || 0 },
    { field: 'Total Assets', value: data.totalAssets || 0 },
    { field: 'Total Purchase Value', value: data.totalPurchaseValue || 0 },
    { field: 'Total Net Book Value', value: data.netBookValue || 0 },
    { field: 'Total Depreciation', value: (data.totalPurchaseValue || 0) - (data.netBookValue || 0) },
  ];
  rows.forEach(r => sheet.addRow(r));

  const valuationData = Array.isArray(data.departments) ? data.departments : [];
  if (valuationData.length > 0) {
    sheet.addRow([]);
    const deptSheet = workbook.addWorksheet('Department Breakdown');
    deptSheet.columns = [
      { header: 'Department', key: 'name', width: 35 },
      { header: 'Code', key: 'code', width: 10 },
      { header: 'Total Assets', key: 'totalAssets', width: 15 },
      { header: 'Purchase Value', key: 'purchaseValue', width: 18 },
      { header: 'Net Book Value', key: 'netBookValue', width: 18 },
      { header: 'Active', key: 'activeAssets', width: 10 },
      { header: 'Maintenance', key: 'maintenanceAssets', width: 12 },
      { header: 'Condemned', key: 'condemnedAssets', width: 12 },
      { header: 'Disposed', key: 'disposedAssets', width: 10 },
    ];
    deptSheet.getRow(1).font = { bold: true };
    valuationData.forEach(d => {
      deptSheet.addRow({
        name: d.name || d.department || '',
        code: d.code || '',
        totalAssets: d.totalAssets || 0,
        purchaseValue: d.totalPurchaseValue || 0,
        netBookValue: d.netBookValue || 0,
        activeAssets: d.activeAssets || 0,
        maintenanceAssets: d.maintenanceAssets || 0,
        condemnedAssets: d.condemnedAssets || 0,
        disposedAssets: d.disposedAssets || 0,
      });
    });
  }

  return workbook.xlsx.writeBuffer();
}

// ===========================================================================
// Generate Financial Report PDF
// ===========================================================================

async function generateFinancialReportPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      initPage(doc, pageNumber);

      drawHeader(
        doc,
        "KONGU ENGINEERING COLLEGE",
        "",
        "FINANCIAL ASSET REPORT",
        "",
        data.financialYear || new Date().getFullYear()
      );

      let y = doc.y + 10;

      sectionHeading(doc, "Report Information", 1);
      const infoPairs = [
        ["Report Date", formatDateDDMMYYYY(data.generatedAt || new Date())],
        ["Financial Year", data.financialYear || new Date().getFullYear()],
        ["Department", data.department || "All Departments"],
        ["Total Assets", String(data.assetCount || 0)],
      ];
      y = drawMetaGrid(doc, infoPairs, y);

      sectionHeading(doc, "Financial Summary", 2);
      const kpis = [
        { label: "Total Purchase Value", value: formatCurrency(data.totalPurchaseValue || 0) },
        { label: "Net Book Value (70%)", value: formatCurrency(data.netBookValue || 0) },
        { label: "Total Depreciation", value: formatCurrency((data.totalPurchaseValue || 0) - (data.netBookValue || 0)) },
        { label: "Asset Count", value: String(data.assetCount || 0) },
      ];
      drawKpis(doc, kpis, 4);

      // Department-wise breakdown
      if (Array.isArray(data.departments) && data.departments.length > 0) {
        sectionHeading(doc, "Department-wise Financial Breakdown", 3);
        const headers = ["Department", "Asset Count", "Total Purchase (INR)", "Net Book Value (INR)"];
        const colWidths = [Math.floor(CONTENT_WIDTH * 0.25), Math.floor(CONTENT_WIDTH * 0.18), Math.floor(CONTENT_WIDTH * 0.28), CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.25) - Math.floor(CONTENT_WIDTH * 0.18) - Math.floor(CONTENT_WIDTH * 0.28)];
        const rows = data.departments.map(d => [
          safeValue(d.department || d.name || ""),
          String(d.assetCount || 0),
          formatCurrency(d.totalPurchaseValue || d.purchaseValue || 0),
          formatCurrency(d.netBookValue || ((d.totalPurchaseValue || 0) * 0.7)),
        ]);
        drawTable(doc, headers, rows, doc.y, colWidths, { fontSize: 7, rowHeight: 16 });
      }

      // Category-wise breakdown
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        sectionHeading(doc, "Category-wise Financial Breakdown", 4);
        const headers = ["Category", "Asset Count", "Total Purchase (INR)", "Net Book Value (INR)"];
        const colWidths = [Math.floor(CONTENT_WIDTH * 0.30), Math.floor(CONTENT_WIDTH * 0.18), Math.floor(CONTENT_WIDTH * 0.25), CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.30) - Math.floor(CONTENT_WIDTH * 0.18) - Math.floor(CONTENT_WIDTH * 0.25)];
        const rows = data.categories.map(c => [
          safeValue(c.category || c.name || ""),
          String(c.assetCount || 0),
          formatCurrency(c.totalPurchaseValue || c.purchaseValue || 0),
          formatCurrency(c.netBookValue || ((c.totalPurchaseValue || 0) * 0.7)),
        ]);
        drawTable(doc, headers, rows, doc.y, colWidths, { fontSize: 7, rowHeight: 16 });
      }

      // Asset listing
      if (Array.isArray(data.assets) && data.assets.length > 0) {
        sectionHeading(doc, "Asset Listing", 5);
        const headers = ["Asset ID", "Name", "Department", "Category", "Purchase Value", "Status"];
        const colWidths = [60, 90, 45, 55, 60, 55];
        const rows = data.assets.map(a => [
          safeValue(a.assetId || ""),
          safeValue(a.name || ""),
          safeValue(a.department || ""),
          safeValue(a.category || ""),
          formatCurrency(a.purchaseValue || 0),
          safeValue(a.status || ""),
        ]);
        drawTable(doc, headers, rows, doc.y, colWidths, { fontSize: 6, rowHeight: 14 });
      }

      // Financial Summary table
      sectionHeading(doc, "Financial Summary Table", 6);
      const finHeaders = ["Metric", "Amount (INR)"];
      const finColWidths = [Math.floor(CONTENT_WIDTH * 0.4), CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.4)];
      const finRows = [
        ["Total Purchase Value", formatCurrency(data.totalPurchaseValue || 0)],
        ["Estimated Depreciation (30%)", formatCurrency((data.totalPurchaseValue || 0) * 0.3)],
        ["Net Book Value (70%)", formatCurrency(data.netBookValue || 0)],
        ["Total Asset Count", String(data.assetCount || 0)],
      ];
      drawWideSummaryTable(doc, finHeaders, finColWidths, finRows, doc.y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================================================================
// Generate Financial Report Excel
// ===========================================================================

async function generateFinancialReportExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Financial Report');
  sheet.columns = [
    { header: 'Field', key: 'field', width: 35 },
    { header: 'Value', key: 'value', width: 50 }
  ];
  sheet.getRow(1).font = { bold: true };

  const rows = [
    { field: 'Report Date', value: data.generatedAt || new Date().toISOString() },
    { field: 'Financial Year', value: data.financialYear || new Date().getFullYear() },
    { field: 'Department', value: data.department || 'All Departments' },
    { field: 'Total Assets', value: data.assetCount || 0 },
    { field: 'Total Purchase Value', value: data.totalPurchaseValue || 0 },
    { field: 'Net Book Value', value: data.netBookValue || 0 },
    { field: 'Depreciation Method', value: 'Straight-Line (30%)' },
  ];
  rows.forEach(r => sheet.addRow(r));

  if (Array.isArray(data.departments) && data.departments.length > 0) {
    sheet.addRow([]);
    sheet.addRow([]);
    const deptSheet = workbook.addWorksheet('Department Breakdown');
    deptSheet.columns = [
      { header: 'Department', key: 'department', width: 25 },
      { header: 'Asset Count', key: 'assetCount', width: 15 },
      { header: 'Total Purchase (INR)', key: 'totalPurchaseValue', width: 20 },
      { header: 'Net Book Value (INR)', key: 'netBookValue', width: 20 },
    ];
    deptSheet.getRow(1).font = { bold: true };
    data.departments.forEach(d => {
      deptSheet.addRow({
        department: d.department || d.name || '',
        assetCount: d.assetCount || 0,
        totalPurchaseValue: d.totalPurchaseValue || d.purchaseValue || 0,
        netBookValue: d.netBookValue || ((d.totalPurchaseValue || 0) * 0.7),
      });
    });
  }

  if (Array.isArray(data.assets) && data.assets.length > 0) {
    const assetSheet = workbook.addWorksheet('Asset Listing');
    assetSheet.columns = [
      { header: 'Asset ID', key: 'assetId', width: 20 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Purchase Value', key: 'purchaseValue', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];
    assetSheet.getRow(1).font = { bold: true };
    data.assets.forEach(a => assetSheet.addRow(a));
  }

  return workbook.xlsx.writeBuffer();
}

// ===========================================================================
// Generate Proforma-I (Equipment Verification) PDF
// ===========================================================================

async function generateProformaIPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      initPage(doc, pageNumber);

      drawHeader(
        doc,
        "KONGU ENGINEERING COLLEGE",
        data.department || "",
        "DEPARTMENTAL STOCK VERIFICATION",
        "Proforma-I",
        data.auditYear || data.financialYear || new Date().getFullYear()
      );

      let y = doc.y;

      // Report Information
      doc
        .fillColor(COLORS.secondary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Report Information", MARGIN_LEFT, y);
      y += 18;

      const infoPairs = [
        ["Department", data.department || data.departmentName || "N/A"],
        ["Asset ID / Register No", data.assetId || data.registerNumber || data.recordId || "N/A"],
        ["Verifier", data.verifier || "N/A"],
        ["Verification Date", formatDateDDMMYYYY(data.verificationDate || data.createdAt)],
        ["Financial Year", data.auditYear || data.financialYear || new Date().getFullYear()],
        ["Status", data.status || "Completed"],
      ];
      y = drawMetaGrid(doc, infoPairs, y);

      // Equipment Verification table
      sectionHeading(doc, "Equipment Verification Details", 1);

      const headers = [
        "Asset/Register No", "Equipment Description", "Book Stock", "Purchases",
        "Physical Stock", "Difference", "Prev Book Value", "Current Purchase",
        "Current Book", "Working Condition", "Outcome",
      ];
      // Distribute columns to fit within page width
      const colWidths = [70, 100, 45, 45, 45, 45, 55, 55, 55, 60, 60];
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      const startX = MARGIN_LEFT + Math.max(0, Math.floor((CONTENT_WIDTH - totalW) / 2));

      // Header row — uses the same pattern as drawTable for consistency
      let docY = doc.y;
      const headerHeight = 20;
      doc.rect(startX, docY, totalW, headerHeight).fill(COLORS.primary);
      doc.fillColor(COLORS.headerText).fontSize(6.5).font("Helvetica-Bold");
      let cx = startX;
      headers.forEach((h, i) => {
        doc.text(h, cx, docY + 5, { width: colWidths[i] - 1, align: "center" });
        cx += colWidths[i];
      });
      docY += headerHeight;

      const rowHeight = 16;

      if (Array.isArray(data.items) && data.items.length > 0) {
        doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
        data.items.forEach((item, idx) => {
          const rowY = docY;

          if (rowY + rowHeight > PRINTABLE_BOTTOM) {
            doc.addPage();
            pageNumber += 1;
            initPage(doc, pageNumber);
            docY = MARGIN_TOP;
            doc.rect(startX, docY, totalW, headerHeight).fill(COLORS.primary);
            doc.fillColor(COLORS.headerText).fontSize(6.5).font("Helvetica-Bold");
            let hx = startX;
            headers.forEach((h, i) => {
              doc.text(h, hx, docY + 5, { width: colWidths[i] - 1, align: "center" });
              hx += colWidths[i];
            });
            docY += headerHeight;
            doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
          }

           if (idx % 2 === 0) {
            doc.rect(startX, docY, totalW, rowHeight).fill(COLORS.altRow);
          }
          doc.rect(startX, docY, totalW, rowHeight).strokeColor(COLORS.borderLight).lineWidth(0.25).stroke();
          doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");

          const values = [
            safeValue(item.assetId || item.registerNumber),
            safeValue(item.equipmentDescription || item.name),
            String(item.bookStock || item.bookStockPreviousYear || 0),
            String(item.purchasesDuringYear || item.purchasedDuringYear || 0),
            String(item.physicalStock || item.actualPhysicalStock || 0),
            String(item.difference || ""),
            safeValue(item.previousBookValue),
            safeValue(item.currentPurchaseValue),
            safeValue(item.currentBookValue),
            safeValue(item.workingCondition),
            safeValue(item.outcome),
          ];

          const alignMap = {
            2: "right", 3: "right", 4: "right", 5: "right",
            6: "right", 7: "right", 8: "right"
          };

          let tx = startX;
          values.forEach((val, i) => {
            doc.text(val, tx, docY + 3, { width: colWidths[i] - 2, align: alignMap[i] || "left" });
            tx += colWidths[i];
          });

          docY += rowHeight;
        });
        y = docY + 10;
      } else {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No equipment items recorded", MARGIN_LEFT, docY);
        y = docY + 20;

        const singleRow = [
          safeValue(data.assetId || ""),
          "N/A",
          "0",
          "0",
          "1",
          "0",
          "N/A",
          "N/A",
          "N/A",
          safeValue(data.condition || ""),
          safeValue(data.status || ""),
        ];
        if (y + rowHeight <= PRINTABLE_BOTTOM) {
          if (0 % 2 === 0) {
            doc.rect(startX, y, totalW, rowHeight).fill(COLORS.altRow);
          }
          doc.rect(startX, y, totalW, rowHeight).strokeColor(COLORS.borderLight).lineWidth(0.25).stroke();
          const alignMap = {
            2: "right", 3: "right", 4: "right", 5: "right",
            6: "right", 7: "right", 8: "right"
          };
          let tx = startX;
          singleRow.forEach((val, i) => {
            doc.fillColor(COLORS.text).fontSize(6).font("Helvetica")
              .text(val, tx, y + 3, { width: colWidths[i] - 2, align: alignMap[i] || "left" });
            tx += colWidths[i];
          });
          y += rowHeight + 10;
        }
      }

      // Summary Totals
      sectionHeading(doc, "Summary Totals", 2);
      if (Array.isArray(data.items) && data.items.length > 0) {
        const totalBookStock = data.items.reduce((s, i) => s + safeNumber(i.bookStock || i.bookStockPreviousYear), 0);
        const totalPurchases = data.items.reduce((s, i) => s + safeNumber(i.purchasesDuringYear || i.purchasedDuringYear), 0);
        const totalPhysical = data.items.reduce((s, i) => s + safeNumber(i.physicalStock || i.actualPhysicalStock), 0);
        const totalDiff = totalBookStock + totalPurchases - totalPhysical;
        const totalPrevBookValue = data.items.reduce((s, i) => s + safeNumber(i.previousBookValue), 0);
        const totalCurrentBook = data.items.reduce((s, i) => s + safeNumber(i.currentBookValue), 0);

        const totalsHeaders = ["Metric", "Value"];
        const totalsColWidths = [Math.floor(CONTENT_WIDTH * 0.45), CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.45)];
        const totalsRows = [
          ["Total Book Stock", String(totalBookStock)],
          ["Total Purchases", String(totalPurchases)],
          ["Total Physical Stock", String(totalPhysical)],
          ["Total Difference", String(totalDiff)],
          ["Total Prev Book Value", formatCurrency(totalPrevBookValue)],
          ["Total Current Book Value", formatCurrency(totalCurrentBook)],
        ];
        drawWideSummaryTable(doc, totalsHeaders, totalsColWidths, totalsRows, doc.y);
      } else {
        const totalsHeaders = ["Metric", "Value"];
        const totalsColWidths = [Math.floor(CONTENT_WIDTH * 0.45), CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.45)];
        const totalsRows = [
          ["Asset ID / Register No", safeValue(data.assetId || data.registerNumber || data.recordId || "")],
          ["Condition", safeValue(data.condition || "N/A")],
          ["Verification Status", safeValue(data.status || "N/A")],
          ["Verified", safeValue(data.verified ? "Yes" : "No")],
        ];
        drawWideSummaryTable(doc, totalsHeaders, totalsColWidths, totalsRows, doc.y);
      }

      // Verification Remarks
      sectionHeading(doc, "Verification Remarks", 3);
      doc
        .fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
        .text(data.verificationNotes || data.remarks || "No remarks provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Recommendations
      if (data.recommendations) {
        doc.moveDown(0.5);
        doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold")
          .text("Recommendations:", MARGIN_LEFT, doc.y);
        doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
          .text(data.recommendations, MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });
      }

      // Sign-off
      const verifyDate = formatDateDDMMYYYY(data.createdAt);
      drawSignatures(doc, [
        { title: "Prepared By", name: data.verifier || "Staff In-Charge", date: verifyDate },
        { title: "Verified By", name: "Audit Officer", date: verifyDate },
      ]);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================================================================
// Generate Proforma-II (Equipment Condemnation) PDF
// ===========================================================================

async function generateProformaIIPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      initPage(doc, pageNumber);

      drawHeader(
        doc,
        "KONGU ENGINEERING COLLEGE",
        data.department || "",
        "EQUIPMENT CONDEMNATION REQUEST",
        "Proforma-II",
        data.auditYear || new Date().getFullYear()
      );

      let y = doc.y;

      // Report Information
      sectionHeading(doc, "Request Information", 1);
      const infoPairs = [
        ["Record ID", data.recordId || ""],
        ["Financial Year", data.auditYear || new Date().getFullYear()],
        ["Department", data.department || "N/A"],
        ["Asset ID", data.assetId || ""],
        ["Equipment Description", data.equipmentDescription || ""],
        ["Quantity", data.quantity || 1],
        ["Purchase Date", formatDateDDMMYYYY(data.purchaseDate)],
        ["Purchase Value", data.purchaseValue ? formatCurrency(data.purchaseValue) : "N/A"],
        ["Book Value", data.bookValue ? formatCurrency(data.bookValue) : "N/A"],
        ["Condition", data.condition || ""],
        ["Status", data.status || "Pending"],
      ];
      drawMetaGrid(doc, infoPairs, doc.y);

      // Reason for Condemnation
      sectionHeading(doc, "Reason for Condemnation", 2);
      doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
        .text(data.reason || "No reason provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Inspection Details
      sectionHeading(doc, "Inspection Details", 3);
      doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
        .text(data.inspectionDetails || "No inspection details provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Loss Details
      sectionHeading(doc, "Loss Details", 4);
      doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
        .text(data.lossDetails || "No loss details provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Repair Cost
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold")
        .text("Repair Cost:", MARGIN_LEFT, doc.y);
      doc.fillColor(COLORS.text).fontSize(9).font("Helvetica")
        .text(data.repairCost ? formatCurrency(data.repairCost) : "N/A", MARGIN_LEFT + 70, doc.y);
      doc.moveDown(0.8);

      // Approval Details
      sectionHeading(doc, "Approval Details", 5);
      const approvalPairs = [
        ["Requested By", data.requestedBy || ""],
        ["Requested At", formatDateDDMMYYYY(data.createdAt)],
        ["Approved By", data.approvedBy || "N/A"],
        ["Approved At", formatDateDDMMYYYY(data.approvedAt)],
      ];
      drawMetaGrid(doc, approvalPairs, doc.y);

      // Items Table
      sectionHeading(doc, "Condemnation Item Details", 6);
      if (Array.isArray(data.items) && data.items.length > 0) {
        const headers = ["Asset ID", "Description", "Quantity", "Book Value (INR)", "Reason", "Condition"];
        const colW = [80, 100, 55, 70, 100, 60];
        const itemRows = data.items.map((item) => [
          safeValue(item.assetId),
          safeValue(item.name || item.description),
          String(item.quantity || 1),
          formatCurrency(item.bookValue || item.purchaseValue || 0),
          safeValue(item.reason),
          safeValue(item.condition),
        ]);
        drawTable(doc, headers, itemRows, doc.y, colW, { fontSize: 6, rowHeight: 16 });
      } else {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No items recorded.", MARGIN_LEFT, doc.y);
        doc.moveDown(0.8);
      }

      // Remarks
      sectionHeading(doc, "Remarks", 7);
      doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
        .text(data.remarks || "No remarks provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Sign-off
      const reqDate = formatDateDDMMYYYY(data.createdAt);
      drawSignatures(doc, [
        { title: "Requested By", name: data.requestedBy || "N/A", date: reqDate },
        { title: "Approved By", name: data.approvedBy || "Awaiting Approval", date: formatDateDDMMYYYY(data.approvedAt) },
        { title: "Department Head", name: "N/A", date: reqDate },
      ]);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================================================================
// Generate Proforma-III (Consumable Verification) PDF
// ===========================================================================

async function generateProformaIIIPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      initPage(doc, pageNumber);

      drawHeader(
        doc,
        "KONGU ENGINEERING COLLEGE",
        data.department || "",
        "CONSUMABLE STOCK VERIFICATION",
        "Proforma-III",
        data.auditYear || new Date().getFullYear()
      );

      let y = doc.y;

      // Report Information
      sectionHeading(doc, "Report Information", 1);
      const infoPairs = [
        ["Record ID", data.recordId || ""],
        ["Financial Year", data.auditYear || new Date().getFullYear()],
        ["Department", data.department || "N/A"],
        ["Laboratory/Section", data.laboratory || "N/A"],
        ["Staff In-Charge", data.staffInCharge || "N/A"],
        ["Verification Date", formatDateDDMMYYYY(data.verificationDate || data.createdAt)],
        ["Status", data.status || "Completed"],
      ];
      drawMetaGrid(doc, infoPairs, doc.y);

      // Consumable Verification table
      sectionHeading(doc, "Consumable Verification Details", 2);

      const headers = [
        "Consumable ID", "Description", "Previous Stock", "Purchases", "Consumed",
        "Book Stock", "Physical Stock", "Difference", "Purchase Value (INR)", "Current Value (INR)", "Outcome",
      ];
      const colWidths = [60, 85, 55, 45, 45, 55, 55, 50, 60, 60, 55];
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      const startX = MARGIN_LEFT + Math.max(0, Math.floor((CONTENT_WIDTH - totalW) / 2));

      let docY = doc.y;
      const headerHeight = 20;
      doc.rect(startX, docY, totalW, headerHeight).fill(COLORS.primary);
      doc.fillColor(COLORS.headerText).fontSize(6).font("Helvetica-Bold");
      let cx = startX;
      headers.forEach((h, i) => {
        doc.text(h, cx, docY + 5, { width: colWidths[i] - 1, align: "center" });
        cx += colWidths[i];
      });
      docY += headerHeight;

      const rowHeight = 16;

      if (Array.isArray(data.items) && data.items.length > 0) {
        doc.fillColor(COLORS.text).fontSize(5.5).font("Helvetica");
        data.items.forEach((item, idx) => {
          const rowY = docY;

          if (rowY + rowHeight > PRINTABLE_BOTTOM) {
            doc.addPage();
            pageNumber += 1;
            initPage(doc, pageNumber);
            docY = MARGIN_TOP;
            doc.rect(startX, docY, totalW, headerHeight).fill(COLORS.primary);
            doc.fillColor(COLORS.headerText).fontSize(6).font("Helvetica-Bold");
            let hx = startX;
            headers.forEach((h, i) => {
              doc.text(h, hx, docY + 5, { width: colWidths[i] - 1, align: "center" });
              hx += colWidths[i];
            });
            docY += headerHeight;
            doc.fillColor(COLORS.text).fontSize(5.5).font("Helvetica");
          }

          if (idx % 2 === 0) {
            doc.rect(startX, docY, totalW, rowHeight).fill(COLORS.altRow);
          }
          doc.rect(startX, docY, totalW, rowHeight).strokeColor(COLORS.borderLight).lineWidth(0.25).stroke();
          doc.fillColor(COLORS.text).fontSize(5.5).font("Helvetica");

          const values = [
            safeValue(item.consumableId),
            safeValue(item.description || item.name),
            String(item.previousStock || 0),
            String(item.purchasedQuantity || item.purchases || 0),
            String(item.consumedQuantity || 0),
            String(item.remainingBookStock || item.bookStock || 0),
            String(item.actualPhysicalStock || item.physicalStock || 0),
            String(item.difference || ""),
            formatCurrency(item.purchaseValue || 0),
            formatCurrency(item.currentValue || item.bookValue || 0),
            safeValue(item.outcome),
          ];

          const alignMap = {
            2: "right", 3: "right", 4: "right", 5: "right",
            6: "right", 7: "right"
          };

          let tx = startX;
          values.forEach((val, i) => {
            doc.text(val, tx, docY + 3, { width: colWidths[i] - 2, align: alignMap[i] || "left" });
            tx += colWidths[i];
          });

          docY += rowHeight;
        });
        y = docY + 10;
      } else {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No consumable items recorded", MARGIN_LEFT, docY);
        y = docY + 20;
      }

      // Verification Remarks
      sectionHeading(doc, "Verification Remarks", 3);
      doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
        .text(data.remarks || "No remarks provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Sign-off
      const verifyDate = formatDateDDMMYYYY(data.createdAt);
      drawSignatures(doc, [
        { title: "Prepared By", name: data.staffInCharge || "N/A", date: verifyDate },
        { title: "Verified By", name: "Audit Officer", date: verifyDate },
      ]);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================================================================
// Generate Proforma-IV (Consumable Condemnation) PDF
// ===========================================================================

async function generateProformaIVPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      initPage(doc, pageNumber);

      drawHeader(
        doc,
        "KONGU ENGINEERING COLLEGE",
        data.department || "",
        "CONSUMABLE CONDEMNATION REQUEST",
        "Proforma-IV",
        data.auditYear || new Date().getFullYear()
      );

      let y = doc.y;

      // Request Information
      sectionHeading(doc, "Request Information", 1);
      const infoPairs = [
        ["Record ID", data.recordId || ""],
        ["Financial Year", data.auditYear || new Date().getFullYear()],
        ["Department", data.department || "N/A"],
        ["Consumable ID", data.consumableId || ""],
        ["Linked Proforma-III", data.verificationRecordId || ""],
        ["Item Description", data.itemDescription || ""],
        ["Quantity", data.quantity || ""],
        ["Book Stock", data.bookStock || ""],
        ["Physical Stock", data.physicalStock || ""],
        ["Difference", data.difference || ""],
        ["Purchase Date", formatDateDDMMYYYY(data.purchaseDate)],
        ["Book Value", data.bookValue ? formatCurrency(data.bookValue) : "N/A"],
        ["Status", data.status || "Pending"],
      ];
      drawMetaGrid(doc, infoPairs, doc.y);

      // Condemnation/Loss Reason
      sectionHeading(doc, "Condemnation/Loss Reason", 2);
      doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
        .text(data.reason || "No reason provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Verification Details
      sectionHeading(doc, "Verification Details", 3);
      doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
        .text(data.verificationDetails || "No verification details provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Approval Details
      sectionHeading(doc, "Approval Details", 4);
      const approvalPairs = [
        ["Requested By", data.requestedBy || ""],
        ["Requested At", formatDateDDMMYYYY(data.createdAt)],
        ["Approved By", data.approvedBy || "N/A"],
        ["Approved At", formatDateDDMMYYYY(data.approvedAt)],
      ];
      drawMetaGrid(doc, approvalPairs, doc.y);

      // Items Table
      sectionHeading(doc, "Condemnation Item Details", 5);
      if (Array.isArray(data.items) && data.items.length > 0) {
        const headers = ["Consumable ID", "Description", "Book Stock", "Physical Stock", "Difference", "Reason"];
        const colW = [70, 100, 55, 60, 50, 100];
        const itemRows = data.items.map((item) => [
          safeValue(item.consumableId),
          safeValue(item.description || item.name),
          safeValue(item.bookStock || ""),
          safeValue(item.actualStock || item.physicalStock || ""),
          safeValue(item.difference || ""),
          safeValue(item.reason || ""),
        ]);
        drawTable(doc, headers, itemRows, doc.y, colW, { fontSize: 6, rowHeight: 16 });
      } else {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No items recorded.", MARGIN_LEFT, doc.y);
        doc.moveDown(0.8);
      }

      // Remarks
      sectionHeading(doc, "Remarks", 6);
      doc.fillColor(COLORS.text).fontSize(8.5).font("Helvetica")
        .text(data.remarks || "No remarks provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Sign-off
      const reqDate = formatDateDDMMYYYY(data.createdAt);
      drawSignatures(doc, [
        { title: "Requested By", name: data.requestedBy || "N/A", date: reqDate },
        { title: "Approved By", name: data.approvedBy || "Awaiting Approval", date: formatDateDDMMYYYY(data.approvedAt) },
        { title: "Department Head", name: "N/A", date: reqDate },
      ]);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================================================================
// Excel Generators for Proformas II, III, IV
// ===========================================================================

/**
 * Generate Excel buffer for Proforma-I (Equipment Verification)
 */
async function generateProformaIExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('P-I Equipment Verification');
  sheet.columns = [
    { header: 'Field', key: 'field', width: 35 },
    { header: 'Value', key: 'value', width: 50 }
  ];
  sheet.getRow(1).font = { bold: true };

  const rows = [
    { field: 'Record ID', value: data.recordId || '' },
    { field: 'Financial Year', value: data.auditYear || data.financialYear || '' },
    { field: 'Department', value: data.department || '' },
    { field: 'Asset ID', value: data.assetId || '' },
    { field: 'Condition', value: data.condition || '' },
    { field: 'Verification Date', value: data.verificationDate || '' },
    { field: 'Verified', value: data.verified ? 'Yes' : 'No' },
    { field: 'Verifier', value: data.verifier || '' },
    { field: 'Status', value: data.status || 'Completed' },
    { field: 'Verification Notes', value: data.verificationNotes || '' },
    { field: 'Recommendations', value: data.recommendations || '' },
    { field: 'Created At', value: data.createdAt || '' }
  ];
  rows.forEach(r => sheet.addRow({ field: r.field, value: r.value }));

  if (Array.isArray(data.items) && data.items.length > 0) {
    sheet.addRow([]);
    const itemSheet = workbook.addWorksheet('Verification Items');
    itemSheet.columns = [
      { header: 'Asset ID', key: 'assetId', width: 20 },
      { header: 'Description', key: 'name', width: 30 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Book Value', key: 'bookValue', width: 15 },
      { header: 'Condition', key: 'condition', width: 15 },
      { header: 'Outcome', key: 'outcome', width: 20 }
    ];
    itemSheet.getRow(1).font = { bold: true };
    data.items.forEach(item => itemSheet.addRow(item));
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * Generate Excel buffer for Proforma-II (Equipment Condemnation)
 */
async function generateProformaIIExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('P-II Equipment Condemnation');
  sheet.columns = [
    { header: 'Field', key: 'field', width: 35 },
    { header: 'Value', key: 'value', width: 50 }
  ];
  sheet.getRow(1).font = { bold: true };
  const rows = [
    { field: 'Record ID', value: data.recordId || '' },
    { field: 'Financial Year', value: data.auditYear || '' },
    { field: 'Department', value: data.department || '' },
    { field: 'Asset ID', value: data.assetId || '' },
    { field: 'Equipment Description', value: data.equipmentDescription || '' },
    { field: 'Quantity', value: data.quantity || 1 },
    { field: 'Purchase Date', value: data.purchaseDate || '' },
    { field: 'Purchase Value', value: data.purchaseValue || '' },
    { field: 'Book Value', value: data.bookValue || '' },
    { field: 'Condition', value: data.condition || '' },
    { field: 'Reason for Condemnation', value: data.reason || '' },
    { field: 'Inspection Details', value: data.inspectionDetails || '' },
    { field: 'Loss Details', value: data.lossDetails || '' },
    { field: 'Repair Cost', value: data.repairCost || '' },
    { field: 'Verification Information', value: data.verificationInfo || '' },
    { field: 'Remarks', value: data.remarks || '' },
    { field: 'Status', value: data.status || 'Pending' },
    { field: 'Requested By', value: data.requestedBy || '' },
    { field: 'Requested At', value: data.createdAt || '' },
    { field: 'Approved By', value: data.approvedBy || '' },
    { field: 'Approved At', value: data.approvedAt || '' }
  ];
  rows.forEach(r => sheet.addRow({ field: r.field, value: r.value }));

  if (Array.isArray(data.items) && data.items.length > 0) {
    sheet.addRow([]);
    sheet.addRow(['Item Details']);
    const itemSheet = workbook.addWorksheet('Condemnation Items');
    itemSheet.columns = [
      { header: 'Asset ID', key: 'assetId', width: 20 },
      { header: 'Description', key: 'name', width: 30 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Book Value', key: 'bookValue', width: 15 },
      { header: 'Reason', key: 'reason', width: 30 },
      { header: 'Condition', key: 'condition', width: 15 }
    ];
    itemSheet.getRow(1).font = { bold: true };
    data.items.forEach(item => itemSheet.addRow(item));
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * Generate Excel buffer for Proforma-III (Consumable Verification)
 */
async function generateProformaIIIExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('P-III Consumable Verification');
  sheet.columns = [
    { header: 'Field', key: 'field', width: 35 },
    { header: 'Value', key: 'value', width: 50 }
  ];
  sheet.getRow(1).font = { bold: true };
  const rows = [
    { field: 'Record ID', value: data.recordId || '' },
    { field: 'Financial Year', value: data.auditYear || '' },
    { field: 'Department', value: data.department || '' },
    { field: 'Laboratory/Section', value: data.laboratory || '' },
    { field: 'Staff In-Charge', value: data.staffInCharge || '' },
    { field: 'Verification Date', value: data.verificationDate || '' },
    { field: 'Remarks', value: data.remarks || '' }
  ];
  rows.forEach(r => sheet.addRow({ field: r.field, value: r.value }));

  if (Array.isArray(data.items) && data.items.length > 0) {
    sheet.addRow([]);
    const itemSheet = workbook.addWorksheet('Consumable Details');
    itemSheet.columns = [
      { header: 'Consumable ID', key: 'consumableId', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Previous Stock', key: 'previousStock', width: 15 },
      { header: 'Purchases', key: 'purchasedQuantity', width: 12 },
      { header: 'Consumed', key: 'consumedQuantity', width: 12 },
      { header: 'Book Stock', key: 'remainingBookStock', width: 12 },
      { header: 'Physical Stock', key: 'actualPhysicalStock', width: 15 },
      { header: 'Difference', key: 'difference', width: 12 },
      { header: 'Purchase Value', key: 'purchaseValue', width: 15 },
      { header: 'Current Value', key: 'currentValue', width: 15 },
      { header: 'Outcome', key: 'outcome', width: 20 }
    ];
    itemSheet.getRow(1).font = { bold: true };
    data.items.forEach(item => itemSheet.addRow(item));
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * Generate Excel buffer for Proforma-IV (Consumable Condemnation)
 */
async function generateProformaIVExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('P-IV Consumable Condemnation');
  sheet.columns = [
    { header: 'Field', key: 'field', width: 35 },
    { header: 'Value', key: 'value', width: 50 }
  ];
  sheet.getRow(1).font = { bold: true };
  const rows = [
    { field: 'Record ID', value: data.recordId || '' },
    { field: 'Financial Year', value: data.auditYear || '' },
    { field: 'Department', value: data.department || '' },
    { field: 'Consumable ID', value: data.consumableId || '' },
    { field: 'Linked Proforma-III', value: data.verificationRecordId || '' },
    { field: 'Item Description', value: data.itemDescription || '' },
    { field: 'Quantity', value: data.quantity || '' },
    { field: 'Book Stock', value: data.bookStock || '' },
    { field: 'Physical Stock', value: data.physicalStock || '' },
    { field: 'Difference', value: data.difference || '' },
    { field: 'Purchase Date', value: data.purchaseDate || '' },
    { field: 'Book Value', value: data.bookValue || '' },
    { field: 'Condemnation/Loss Reason', value: data.reason || '' },
    { field: 'Verification Details', value: data.verificationDetails || '' },
    { field: 'Remarks', value: data.remarks || '' },
    { field: 'Status', value: data.status || 'Pending' },
    { field: 'Requested By', value: data.requestedBy || '' },
    { field: 'Requested At', value: data.createdAt || '' },
    { field: 'Approved By', value: data.approvedBy || '' },
    { field: 'Approved At', value: data.approvedAt || '' }
  ];
  rows.forEach(r => sheet.addRow({ field: r.field, value: r.value }));

  if (Array.isArray(data.items) && data.items.length > 0) {
    sheet.addRow([]);
    const itemSheet = workbook.addWorksheet('Condemnation Items');
    itemSheet.columns = [
      { header: 'Consumable ID', key: 'consumableId', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Book Stock', key: 'bookStock', width: 12 },
      { header: 'Physical Stock', key: 'actualStock', width: 15 },
      { header: 'Difference', key: 'difference', width: 12 },
      { header: 'Reason', key: 'reason', width: 30 }
    ];
    itemSheet.getRow(1).font = { bold: true };
    data.items.forEach(item => itemSheet.addRow(item));
  }

  return workbook.xlsx.writeBuffer();
}

// ===========================================================================
// Generate Audit Report Excel Buffer
// ===========================================================================

async function generateExcelBuffer(reportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ChainTrack Asset Management";
  workbook.created = new Date();

  // Sheet 1: Executive Summary
  const summarySheet = workbook.addWorksheet("Audit Summary");
  summarySheet.columns = [
    { header: "Metric / Description", key: "metric", width: 35 },
    { header: "Value", key: "value", width: 25 }
  ];
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E40AF" } };

  summarySheet.addRows([
    { metric: "Report ID", value: reportData.reportId || `REP-${reportData.year}` },
    { metric: "Audit Year", value: reportData.year || new Date().getFullYear() },
    { metric: "Audit Officer", value: reportData.auditOfficer || "Administrator" },
    { metric: "Audit Date", value: new Date(reportData.auditDate || Date.now()).toLocaleDateString() },
    { metric: "Total Registered Assets", value: reportData.totalAssets || 0 },
    { metric: "Total Portfolio Value (₹)", value: reportData.totalPurchaseValue || 0 },
    { metric: "Active Assets", value: reportData.activeAssets || 0 },
    { metric: "Maintenance Assets", value: reportData.maintenanceAssets || 0 },
    { metric: "Condemned Assets", value: reportData.condemnedAssets || 0 },
    { metric: "Disposed / Retired Assets", value: reportData.disposedAssets || 0 },
    { metric: "Total Bills", value: reportData.totalBills || 0 },
    { metric: "Total Bill Value (₹)", value: reportData.totalBillValue || 0 },
    { metric: "Total Maintenance Records", value: reportData.totalMaintenance || 0 },
    { metric: "Total Maintenance Cost (₹)", value: reportData.totalMaintenanceCost || 0 },
    { metric: "Total Transfers", value: reportData.totalTransfers || 0 },
    { metric: "Total Consumables", value: (reportData.consumablesList || []).length }
  ]);

  // Department Breakdown
  summarySheet.addRow([]);
  const deptHeaderRow = summarySheet.addRow(["Department Breakdown", "Asset Count", "Total Value (₹)"]);
  deptHeaderRow.font = { bold: true };
  const deptSummary = reportData.departmentSummary || {};
  Object.keys(deptSummary).forEach((dept) => {
    const item = typeof deptSummary[dept] === "object" ? deptSummary[dept] : { count: deptSummary[dept], totalValue: 0 };
    summarySheet.addRow([dept, item.count || item.totalAssets || 0, item.totalValue || item.totalPurchaseValue || 0]);
  });

  // Sheet 2: Asset Inventory
  if (Array.isArray(reportData.assetsList) && reportData.assetsList.length > 0) {
    const assetSheet = workbook.addWorksheet("Asset Inventory");
    assetSheet.columns = [
      { header: "Asset ID", key: "assetId", width: 15 },
      { header: "Name", key: "name", width: 30 },
      { header: "Category", key: "category", width: 20 },
      { header: "Department", key: "department", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Location", key: "location", width: 25 },
      { header: "Purchase Date", key: "purchaseDate", width: 15 },
      { header: "Purchase Value (₹)", key: "purchaseValue", width: 18 },
      { header: "Serial Number", key: "serialNumber", width: 20 }
    ];
    assetSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
    assetSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E40AF" } };
    reportData.assetsList.forEach((ast) => {
      assetSheet.addRow({
        assetId: ast.assetId, name: ast.name, category: ast.category, department: ast.department,
        status: ast.status, location: ast.location || "", purchaseDate: ast.purchaseDate || "",
        purchaseValue: ast.purchaseValue || 0, serialNumber: ast.serialNumber || ""
      });
    });
  }

  // Sheet 3: Bills
  if (Array.isArray(reportData.billsList) && reportData.billsList.length > 0) {
    const billSheet = workbook.addWorksheet("Bills");
    billSheet.columns = [
      { header: "Bill ID", key: "billId", width: 20 },
      { header: "Asset ID", key: "assetId", width: 15 },
      { header: "Vendor", key: "vendor", width: 30 },
      { header: "Invoice Number", key: "invoiceNumber", width: 20 },
      { header: "Amount (₹)", key: "amount", width: 15 },
      { header: "Payment Status", key: "paymentStatus", width: 15 }
    ];
    billSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
    billSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E40AF" } };
    reportData.billsList.forEach((bill) => {
      billSheet.addRow({
        billId: bill.billId || bill.id || "", assetId: bill.assetId || "", vendor: bill.vendor || "",
        invoiceNumber: bill.invoiceNumber || "", amount: bill.amount || 0, paymentStatus: bill.paymentStatus || "Paid"
      });
    });
  }

  // Sheet 4: Maintenance
  if (Array.isArray(reportData.maintenanceList) && reportData.maintenanceList.length > 0) {
    const mntSheet = workbook.addWorksheet("Maintenance");
    mntSheet.columns = [
      { header: "Record ID", key: "recordId", width: 20 },
      { header: "Asset ID", key: "assetId", width: 15 },
      { header: "Technician", key: "technician", width: 25 },
      { header: "Date", key: "maintenanceDate", width: 15 },
      { header: "Cost (₹)", key: "cost", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Description", key: "description", width: 30 }
    ];
    mntSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
    mntSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E40AF" } };
    reportData.maintenanceList.forEach((m) => {
      mntSheet.addRow({
        recordId: m.recordId || m.id || "", assetId: m.assetId || "", technician: m.technician || "",
        maintenanceDate: m.maintenanceDate || m.createdAt || "", cost: m.cost || 0,
        status: m.status || "Completed", description: m.description || ""
      });
    });
  }

  // Sheet 5: Transfers
  if (Array.isArray(reportData.transfersList) && reportData.transfersList.length > 0) {
    const transferSheet = workbook.addWorksheet("Transfers");
    transferSheet.columns = [
      { header: "Transfer ID", key: "transferId", width: 25 },
      { header: "Asset ID", key: "assetId", width: 15 },
      { header: "From Department", key: "fromDepartment", width: 20 },
      { header: "To Department", key: "toDepartment", width: 20 },
      { header: "Date", key: "date", width: 20 },
      { header: "Status", key: "status", width: 15 }
    ];
    transferSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
    transferSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E40AF" } };
    reportData.transfersList.forEach((tr) => {
      transferSheet.addRow({
        transferId: tr.transferId || "", assetId: tr.assetId || "", fromDepartment: tr.fromDepartment || "",
        toDepartment: tr.toDepartment || "", date: tr.date || tr.createdAt || "", status: tr.status || "Completed"
      });
    });
  }

  // Sheet 6: Consumables
  if (Array.isArray(reportData.consumablesList) && reportData.consumablesList.length > 0) {
    const consSheet = workbook.addWorksheet("Consumables");
    consSheet.columns = [
      { header: "Consumable ID", key: "consumableId", width: 20 },
      { header: "Name", key: "name", width: 25 },
      { header: "Department", key: "department", width: 15 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Current Stock", key: "currentStock", width: 15 },
      { header: "Purchase Value (₹)", key: "purchaseValue", width: 18 },
      { header: "Location", key: "location", width: 20 }
    ];
    consSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
    consSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E40AF" } };
    reportData.consumablesList.forEach((c) => {
      consSheet.addRow({
        consumableId: c.consumableId || "", name: c.name || "", department: c.department || "",
        unit: c.unit || "Units", currentStock: c.currentStock !== undefined ? c.currentStock : (c.bookStock || 0),
        purchaseValue: c.purchaseValue || 0, location: c.location || ""
      });
    });
  }

  // Sheet 7: Condemnation Records
  if (Array.isArray(reportData.condemnationList) && reportData.condemnationList.length > 0) {
    const condSheet = workbook.addWorksheet("Condemnations");
    condSheet.columns = [
      { header: "Record ID", key: "recordId", width: 20 },
      { header: "Asset ID", key: "assetId", width: 15 },
      { header: "Department", key: "department", width: 15 },
      { header: "Reason", key: "reason", width: 30 },
      { header: "Status", key: "status", width: 15 },
      { header: "Requested By", key: "requestedBy", width: 20 },
      { header: "Created At", key: "createdAt", width: 20 }
    ];
    condSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
    condSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E40AF" } };
    reportData.condemnationList.forEach((c) => {
      condSheet.addRow({
        recordId: c.recordId || c.id || "", assetId: c.assetId || "", department: c.department || "",
        reason: c.reason || "", status: c.status || "Pending", requestedBy: c.requestedBy || "",
        createdAt: c.createdAt || c.requestedAt || ""
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// ===========================================================================
// FINANCIAL TAB PDF — Portfolio valuation, depreciation, asset ledger
// ===========================================================================

// ===========================================================================
// Module Exports
// ===========================================================================

module.exports = {
  generatePdfBuffer,
  generateExcelBuffer,
  generateFinancialReportPdf,
  generateFinancialReportExcel,
  generateValuationPdf,
  generateValuationExcel,
  generateProformaIPdf,
  generateProformaIExcel,
  generateProformaIIPdf,
  generateProformaIIIPdf,
  generateProformaIVPdf,
  generateProformaIIExcel,
  generateProformaIIIExcel,
  generateProformaIVExcel,
};
