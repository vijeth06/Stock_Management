const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const LINE_HEIGHT = 1.4;

const COLORS = {
  primary: "#1e3a8a",
  primaryDark: "#1e40af",
  secondary: "#0f172a",
  text: "#0f172a",
  muted: "#64748b",
  border: "#cbd5e1",
  borderLight: "#e2e8f0",
  headerBg: "#1e40af",
  headerText: "#ffffff",
  tableHeaderBg: "#f1f5f9",
  tableHeaderText: "#334155",
  altRow: "#f8fafc",
  footerBg: "#f8fafc",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
};

// ---------------------------------------------------------------------------
// Helper: format date string safely
// ---------------------------------------------------------------------------
function formatDate(dateStr) {
  try {
    return new Date(dateStr || Date.now()).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return new Date().toLocaleDateString();
  }
}

// ---------------------------------------------------------------------------
// Helper: format currency
// ---------------------------------------------------------------------------
function formatCurrency(value) {
  const num = Number(value) || 0;
  return `INR ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Helper: draw the organization header banner
// ---------------------------------------------------------------------------
function drawHeaderBanner(doc, title, subtitle) {
  doc.rect(MARGIN_LEFT, MARGIN_TOP - 10, CONTENT_WIDTH, 55).fill(COLORS.headerBg);
  doc.fillColor(COLORS.headerText).fontSize(18).font("Helvetica-Bold")
    .text(title, MARGIN_LEFT + 10, MARGIN_TOP + 5);
  doc.fillColor(COLORS.headerText).fontSize(10).font("Helvetica")
    .text(subtitle, MARGIN_LEFT + 10, MARGIN_TOP + 22);
  doc.moveDown();
  return MARGIN_TOP + 55;
}

// ---------------------------------------------------------------------------
// Helper: draw a styled section heading
// ---------------------------------------------------------------------------
function sectionHeading(doc, text, number) {
  doc.fillColor(COLORS.primary).fontSize(13).font("Helvetica-Bold")
    .text(`${number}. ${text}`, MARGIN_LEFT, doc.y);
  const titleWidth = doc.widthOfString(`${number}. ${text}`, { fontSize: 13 });
  doc.rect(MARGIN_LEFT, doc.y - 4, Math.max(titleWidth, 60), 1.5).fill(COLORS.primary);
  doc.moveDown(0.6);
}

// ---------------------------------------------------------------------------
// Helper: add footer with page number to every page
// ---------------------------------------------------------------------------
function addFooter(doc, pageNumber) {
  const origY = doc.y;
  const footerTop = PAGE_HEIGHT - MARGIN_BOTTOM + 10;
  doc.rect(MARGIN_LEFT, footerTop - 5, CONTENT_WIDTH, 0.5).strokeColor(COLORS.borderLight);
  doc.fillColor(COLORS.muted).fontSize(8).font("Helvetica-Oblique")
    .text("ChainTrack Asset Management  |  Hyperledger Fabric Blockchain Verified",
      MARGIN_LEFT, footerTop);
  doc.fillColor(COLORS.muted).fontSize(8).font("Helvetica")
    .text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN_RIGHT - 30, footerTop, { align: "right" });
  doc.y = origY;
}

// ---------------------------------------------------------------------------
// Helper: draw a row of KPI badges
// ---------------------------------------------------------------------------
function drawKpis(doc, kpis) {
  const rowHeight = 24;
  const colCount = 3;
  const badgeWidth = Math.floor(CONTENT_WIDTH / colCount) - 8;
  const colGap = 8;

  kpis.forEach((kpi, idx) => {
    const col = idx % colCount;
    const row = Math.floor(idx / colCount);
    const x = MARGIN_LEFT + col * (badgeWidth + colGap);
    const y = doc.y + row * (rowHeight + 6);

    doc.rect(x, y, badgeWidth, rowHeight).fill(COLORS.altRow).stroke(COLORS.borderLight);
    doc.fillColor(COLORS.muted).fontSize(7.5).font("Helvetica")
      .text(kpi.label, x + 6, y + 3, { width: badgeWidth - 12 });
    doc.fillColor(COLORS.secondary).fontSize(11).font("Helvetica-Bold")
      .text(kpi.value, x + 6, y + 12, { width: badgeWidth - 12 });
  });

  doc.moveDown(kpis.length > colCount ? 2 : 1);
}

// ---------------------------------------------------------------------------
// Helper: draw a 3-column summary table
// ---------------------------------------------------------------------------
function drawSummaryTable(doc, headers, rows, startY, fontSize = 8, rowHeight = 18) {
  let docY = startY;
  const colWidths = [
    Math.floor(CONTENT_WIDTH * 0.38),
    Math.floor(CONTENT_WIDTH * 0.22),
    CONTENT_WIDTH - Math.floor(CONTENT_WIDTH * 0.38) - Math.floor(CONTENT_WIDTH * 0.22),
  ];

  function drawHeader() {
    doc.rect(MARGIN_LEFT, docY, CONTENT_WIDTH, rowHeight).fill(COLORS.headerBg);
    doc.fillColor(COLORS.headerText).fontSize(fontSize).font("Helvetica-Bold");
    let startX = MARGIN_LEFT;
    headers.forEach((h, i) => {
      doc.text(h, startX, docY + 5, { width: colWidths[i], align: "left" });
      startX += colWidths[i];
    });
    docY += rowHeight;
  }

  drawHeader();

  rows.forEach((row, ri) => {
    const rowY = docY + ri * rowHeight;

    if (rowY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 15) {
      doc.addPage();
      docY = MARGIN_TOP;
      addFooter(doc, doc.bufferedPageRange().start + 2);
      drawHeader();
      ri = -1;
    }

    if ((ri + 1) % 2 === 0) {
      doc.rect(MARGIN_LEFT, rowY, CONTENT_WIDTH, rowHeight).fill(COLORS.altRow);
    }

    doc.fillColor(COLORS.text).fontSize(fontSize).font("Helvetica");
    let cx = MARGIN_LEFT;
    row.forEach((cell, ci) => {
      doc.text(String(cell), cx, rowY + 4, { width: colWidths[ci], align: "left" });
      cx += colWidths[ci];
    });
  });

  return docY + rows.length * rowHeight;
}

// ---------------------------------------------------------------------------
// Helper: draw a detail table with many columns
// ---------------------------------------------------------------------------
function drawDetailTable(doc, headers, colWidths, rows, startY, fontSize = 7, rowHeight = 16) {
  let docY = startY;
  const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = MARGIN_LEFT + Math.max(0, (CONTENT_WIDTH - totalTableWidth) / 2);

  function drawHeader() {
    doc.rect(startX, docY, totalTableWidth, rowHeight + 4).fill(COLORS.headerBg);
    doc.fillColor(COLORS.headerText).fontSize(fontSize + 1).font("Helvetica-Bold");
    let cx = startX;
    headers.forEach((h, i) => {
      doc.text(h, cx, docY + 5, { width: colWidths[i], align: "center" });
      cx += colWidths[i];
    });
    docY += rowHeight + 4;
  }

  drawHeader();

  rows.forEach((row, ri) => {
    const rowY = docY;

    if (rowY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
      doc.addPage();
      docY = MARGIN_TOP;
      addFooter(doc, doc.bufferedPageRange().start + 2);
      drawHeader();
    }

    if (ri % 2 === 0) {
      doc.rect(startX, docY, totalTableWidth, rowHeight).fill(COLORS.altRow);
    }

    doc.fillColor(COLORS.text).fontSize(fontSize).font("Helvetica");
    let tx = startX;
    row.forEach((cell, ci) => {
      doc.text(String(cell), tx, docY + 3, { width: colWidths[ci] - 2, align: "left" });
      tx += colWidths[ci];
    });

    docY += rowHeight;
  });

  return docY + 10;
}

// ---------------------------------------------------------------------------
// Helper: check if we need a page break and optionally add one
// ---------------------------------------------------------------------------
function ensureSpace(doc, needed, sectionTitle) {
  const pageNum = doc.bufferedPageRange().start + 1;
  if (doc.y + needed > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
    doc.addPage();
    addFooter(doc, pageNum + 1);
    if (sectionTitle) {
      doc.fillColor(COLORS.primary).fontSize(13).font("Helvetica-Bold")
        .text(sectionTitle, MARGIN_LEFT, doc.y);
      doc.moveDown(0.3);
    }
    return doc.y;
  }
  return doc.y;
}

// ---------------------------------------------------------------------------
// Helper: draw a metadata field row (label + value)
// ---------------------------------------------------------------------------
function drawMetaRow(doc, label, value, labelX, valueX, y) {
  doc.fillColor(COLORS.secondary).fontSize(8.5).font("Helvetica-Bold");
  doc.text(`${label}:`, labelX, y);
  doc.fillColor(COLORS.text).font("Helvetica").text(String(value || "N/A"), valueX, y);
  return y + 13;
}

// ---------------------------------------------------------------------------
// Generate Annual Audit Report PDF
// ---------------------------------------------------------------------------
async function generatePdfBuffer(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      addFooter(doc, pageNumber);

      // ==============================
      // Cover Page
      // ==============================
      doc.rect(MARGIN_LEFT, MARGIN_TOP - 10, CONTENT_WIDTH, 70).fill(COLORS.headerBg);

      doc.fillColor(COLORS.headerText).fontSize(20).font("Helvetica-Bold")
        .text("CHAINTRACK ASSET MANAGEMENT", MARGIN_LEFT + 10, MARGIN_TOP + 12);
      doc.fillColor(COLORS.headerText).fontSize(12).font("Helvetica")
        .text(`Annual Audit & Inventory Report (${reportData.year || new Date().getFullYear()})`,
          MARGIN_LEFT + 10, MARGIN_TOP + 36);

      let y = MARGIN_TOP + 70;

      // Metadata Box
      doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 50).fillAndStroke(COLORS.altRow, COLORS.border);
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold");
      doc.text("Report ID:", MARGIN_LEFT + 8, y + 8);
      doc.fillColor(COLORS.text).font("Helvetica")
        .text(reportData.reportId || `REP-${reportData.year}`, MARGIN_LEFT + 60, y + 8);

      doc.fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text("Audit Officer:", MARGIN_LEFT + 8, y + 24);
      doc.fillColor(COLORS.text).font("Helvetica")
        .text(reportData.auditOfficer || "Administrator", MARGIN_LEFT + 72, y + 24);

      doc.fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text("Audit Period:", MARGIN_LEFT + 210, y + 8);
      doc.fillColor(COLORS.text).font("Helvetica")
        .text(reportData.auditPeriod || `FY ${reportData.year || new Date().getFullYear()}`,
          MARGIN_LEFT + 285, y + 8);

      doc.fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text("Generated On:", MARGIN_LEFT + 210, y + 24);
      doc.fillColor(COLORS.text).font("Helvetica")
        .text(formatDate(reportData.auditDate || reportData.generatedAt),
          MARGIN_LEFT + 285, y + 24);

      y += 62;

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
      drawKpis(doc, kpis);

      // Department Breakdown
      sectionHeading(doc, "Departmental Breakdown", 2);
      const deptSummary = reportData.departmentSummary || {};
      const deptKeys = Object.keys(deptSummary);
      if (deptKeys.length === 0) {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No department summary available", MARGIN_LEFT, doc.y);
        doc.moveDown(1);
      } else {
        const deptHeaders = ["Department", "Asset Count", "Total Value (INR)"];
        const deptRows = deptKeys.map((dept) => {
          const item = typeof deptSummary[dept] === "object"
            ? deptSummary[dept]
            : { totalAssets: deptSummary[dept], totalPurchaseValue: 0 };
          return [dept, String(item.totalAssets || item.count || 0), formatCurrency(item.totalPurchaseValue || item.totalValue || 0)];
        });
        drawSummaryTable(doc, deptHeaders, deptRows, doc.y);
        doc.moveDown(1);
      }

      // Category Breakdown
      sectionHeading(doc, "Category Summary", 3);
      const catSummary = reportData.categorySummary || {};
      const catKeys = Object.keys(catSummary);
      if (catKeys.length === 0) {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No category summary available", MARGIN_LEFT, doc.y);
        doc.moveDown(1);
      } else {
        const catHeaders = ["Category", "Asset Count", "Total Value (INR)"];
        const catRows = catKeys.map((cat) => {
          const item = typeof catSummary[cat] === "object"
            ? catSummary[cat]
            : { totalAssets: catSummary[cat], totalPurchaseValue: 0 };
          return [cat, String(item.totalAssets || item.count || 0), formatCurrency(item.totalPurchaseValue || item.totalValue || 0)];
        });
        drawSummaryTable(doc, catHeaders, catRows, doc.y);
        doc.moveDown(1);
      }

      // Valuation Summary
      sectionHeading(doc, "Department Valuation Summary", 4);
      const valuation = reportData.valuationData || {};
      const valKeys = Object.keys(valuation);
      if (valKeys.length === 0) {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No valuation data available", MARGIN_LEFT, doc.y);
        doc.moveDown(1);
      } else {
        const valHeaders = ["Department", "Total Assets", "Total Value (INR)", "Net Book Value (INR)"];
        const valRows = valKeys.map((key) => {
          const v = valuation[key] || {};
          return [
            v.name || key,
            String(v.totalAssets || 0),
            formatCurrency(v.totalPurchaseValue || 0),
            formatCurrency(v.netBookValue || 0),
          ];
        });
        drawSummaryTable(doc, valHeaders, valRows, doc.y);
        doc.moveDown(1);
      }

      // Financial / Bills Summary
      sectionHeading(doc, "Financial / Bills Summary", 5);
      doc.fillColor(COLORS.secondary).fontSize(10).font("Helvetica-Bold");
      doc.text("Total Bills:", MARGIN_LEFT, doc.y);
      doc.fillColor(COLORS.primaryDark).text(String(reportData.totalBills || 0), MARGIN_LEFT + 80, doc.y);
      doc.moveDown(0.5);

      doc.fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text("Total Bill Value:", MARGIN_LEFT, doc.y);
      doc.fillColor(COLORS.primaryDark).text(formatCurrency(reportData.totalBillValue || 0), MARGIN_LEFT + 100, doc.y);
      doc.moveDown(0.5);

      doc.fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text("Total Maintenance Cost:", MARGIN_LEFT, doc.y);
      doc.fillColor(COLORS.primaryDark).text(formatCurrency(reportData.totalMaintenanceCost || 0), MARGIN_LEFT + 115, doc.y);
      doc.moveDown(1);

      // Maintenance Summary
      sectionHeading(doc, "Maintenance Summary", 6);
      doc.fillColor(COLORS.secondary).fontSize(10).font("Helvetica-Bold");
      doc.text("Total Maintenance Records:", MARGIN_LEFT, doc.y);
      doc.fillColor(COLORS.primaryDark).text(String(reportData.totalMaintenance || 0), MARGIN_LEFT + 140, doc.y);
      doc.moveDown(1);

      // Transfers Summary
      sectionHeading(doc, "Transfers Summary", 7);
      doc.fillColor(COLORS.secondary).fontSize(10).font("Helvetica-Bold");
      doc.text("Total Transfers:", MARGIN_LEFT, doc.y);
      doc.fillColor(COLORS.primaryDark).text(String(reportData.totalTransfers || 0), MARGIN_LEFT + 90, doc.y);

      // Sign-off / Signatures
      ensureSpace(doc, 90);
      doc.moveDown(0.5);

      doc.rect(MARGIN_LEFT, doc.y, CONTENT_WIDTH, 75).fillAndStroke(COLORS.footerBg, COLORS.borderLight);

      doc.fillColor(COLORS.secondary).fontSize(10).font("Helvetica-Bold")
        .text("Audit Sign-off & Blockchain Verification", MARGIN_LEFT + 8, doc.y + 8);

      doc.fillColor(COLORS.muted).fontSize(8).font("Helvetica")
        .text("This document is verified and recorded on the Hyperledger Fabric ledger.",
          MARGIN_LEFT + 8, doc.y + 10);

      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text("_________________________", MARGIN_LEFT + 8, doc.y + 22);
      doc.text("Audit Officer Signature", MARGIN_LEFT + 8, doc.y);

      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text("_________________________", MARGIN_LEFT + 200, doc.y - 12);
      doc.text("Department Head Approval", MARGIN_LEFT + 200, doc.y);

      // ==============================
      // Detail Tables (subsequent pages)
      // ==============================

      // Detailed Asset Table
      if (Array.isArray(reportData.assetsList) && reportData.assetsList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        addFooter(doc, pageNumber);
        sectionHeading(doc, "Asset Registry Details", 8);

        const assetHeaders = ["Asset ID", "Name", "Department", "Category", "Status", "Value (INR)"];
        const assetColWidths = [85, 150, 90, 85, 70, 75];
        const assetRows = reportData.assetsList.map((ast) => [
          String(ast.assetId || ""),
          String(ast.name || ""),
          String(ast.department || ""),
          String(ast.category || ""),
          String(ast.status || ""),
          formatCurrency(ast.purchaseValue || 0),
        ]);
        drawDetailTable(doc, assetHeaders, assetColWidths, assetRows, doc.y, 7, 16);
      }

      // Maintenance Detail Table
      if (Array.isArray(reportData.maintenanceList) && reportData.maintenanceList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        addFooter(doc, pageNumber);
        sectionHeading(doc, "Maintenance Records", 9);

        const mntHeaders = ["Record ID", "Asset ID", "Technician", "Date", "Cost (INR)", "Status", "Description"];
        const mntColWidths = [80, 90, 80, 75, 65, 60, 115];
        const mntRows = reportData.maintenanceList.map((m) => [
          String(m.recordId || m.id || ""),
          String(m.assetId || ""),
          String(m.technician || ""),
          formatDate(m.maintenanceDate || m.createdAt),
          formatCurrency(m.cost || 0),
          String(m.status || "Completed"),
          String(m.description || ""),
        ]);
        drawDetailTable(doc, mntHeaders, mntColWidths, mntRows, doc.y, 6, 16);
      }

      // Bills Detail Table
      if (Array.isArray(reportData.billsList) && reportData.billsList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        addFooter(doc, pageNumber);
        sectionHeading(doc, "Bills / Purchase Records", 10);

        const billHeaders = ["Bill ID", "Asset ID", "Vendor", "Invoice", "Amount (INR)", "Status"];
        const billColWidths = [90, 90, 100, 80, 65, 55];
        const billRows = reportData.billsList.map((bill) => [
          String(bill.billId || bill.id || ""),
          String(bill.assetId || ""),
          String(bill.vendor || ""),
          String(bill.invoiceNumber || ""),
          formatCurrency(bill.amount || 0),
          String(bill.paymentStatus || "Paid"),
        ]);
        drawDetailTable(doc, billHeaders, billColWidths, billRows, doc.y, 7, 16);
      }

      // Transfers Detail Table
      if (Array.isArray(reportData.transfersList) && reportData.transfersList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        addFooter(doc, pageNumber);
        sectionHeading(doc, "Asset Transfers", 11);

        const trHeaders = ["Transfer ID", "Asset ID", "From Dept", "To Dept", "Date", "Status"];
        const trColWidths = [90, 90, 75, 75, 85, 60];
        const trRows = reportData.transfersList.map((tr) => [
          String(tr.transferId || ""),
          String(tr.assetId || ""),
          String(tr.fromDepartment || ""),
          String(tr.toDepartment || ""),
          formatDate(tr.date || tr.createdAt),
          String(tr.status || "Completed"),
        ]);
        drawDetailTable(doc, trHeaders, trColWidths, trRows, doc.y, 7, 16);
      }

      // Consumables Detail Table
      if (Array.isArray(reportData.consumablesList) && reportData.consumablesList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        addFooter(doc, pageNumber);
        sectionHeading(doc, "Consumables Inventory", 12);

        const consHeaders = ["Consumable ID", "Name", "Department", "Unit", "Current Stock", "Purchase Value (INR)", "Location"];
        const consColWidths = [85, 120, 85, 55, 65, 75, 80];
        const consRows = reportData.consumablesList.map((c) => [
          String(c.consumableId || ""),
          String(c.name || ""),
          String(c.department || ""),
          String(c.unit || ""),
          String(c.currentStock !== undefined ? c.currentStock : ""),
          formatCurrency(c.purchaseValue || 0),
          String(c.location || ""),
        ]);
        drawDetailTable(doc, consHeaders, consColWidths, consRows, doc.y, 6, 16);
      }

      // Condemnation Records Table
      if (Array.isArray(reportData.condemnationList) && reportData.condemnationList.length > 0) {
        doc.addPage();
        pageNumber += 1;
        addFooter(doc, pageNumber);
        sectionHeading(doc, "Condemnation Records", 13);

        const condHeaders = ["Record ID", "Asset ID", "Department", "Reason", "Status", "Requested By", "Created At"];
        const condColWidths = [80, 90, 75, 100, 65, 70, 75];
        const condRows = reportData.condemnationList.map((c) => [
          String(c.recordId || c.id || ""),
          String(c.assetId || ""),
          String(c.department || ""),
          String(c.reason || ""),
          String(c.status || "Pending"),
          String(c.requestedBy || ""),
          formatDate(c.createdAt || c.requestedAt),
        ]);
        drawDetailTable(doc, condHeaders, condColWidths, condRows, doc.y, 6, 16);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Generate Proforma-I (Equipment Verification) PDF
// ---------------------------------------------------------------------------
async function generateProformaIPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      addFooter(doc, pageNumber);

      // Header Banner
      drawHeaderBanner(doc, "KONGU ENGINEERING COLLEGE", "Departmental Stock Verification - Proforma-I");

      let y = MARGIN_TOP + 55;

      // Metadata section
      const metaFields = [
        ["Financial Year", data.auditYear || data.financialYear || new Date().getFullYear()],
        ["Department", data.department || "N/A"],
        ["Laboratory/Workshop", data.laboratory || data.workshop || "N/A"],
        ["Staff In-Charge", data.staffInCharge || "N/A"],
        ["Verification Date", data.verificationDate || formatDate(data.createdAt || data.verifiedDate)],
        ["Status", data.status || "Completed"],
      ];
      let my = y;
      doc.fillColor(COLORS.secondary).fontSize(8.5).font("Helvetica-Bold");
      metaFields.forEach(([label, val]) => {
        my = drawMetaRow(doc, label, val, MARGIN_LEFT, MARGIN_LEFT + 100, my);
      });
      y = my + 5;

      // Equipment Verification table
      doc.fillColor(COLORS.primary).fontSize(13).font("Helvetica-Bold").text("Equipment Verification Details", MARGIN_LEFT, doc.y);
      y = doc.y + 8;

      const headers = [
        "Asset/Register No", "Equipment Description", "Book Stock", "Purchases",
        "Physical Stock", "Difference", "Prev Book Value", "Current Purchase",
        "Current Book", "Working Condition", "Outcome",
      ];
      const numCols = headers.length;
      const colWidth = Math.floor(CONTENT_WIDTH / numCols);
      const colWidths = new Array(numCols).fill(colWidth);
      colWidths[numCols - 1] = CONTENT_WIDTH - colWidth * (numCols - 1);

      // Draw header row
      doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 20).fill(COLORS.headerBg);
      doc.fillColor(COLORS.headerText).fontSize(7).font("Helvetica-Bold");
      let cx = MARGIN_LEFT;
      headers.forEach((h, i) => {
        doc.text(h, cx, y + 6, { width: colWidths[i], align: "center" });
        cx += colWidths[i];
      });
      y += 20;

      if (Array.isArray(data.items) && data.items.length > 0) {
        doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
        data.items.forEach((item, idx) => {
          if (y + 20 > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
            doc.addPage();
            pageNumber += 1;
            addFooter(doc, pageNumber);
            y = MARGIN_TOP;
            doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 20).fill(COLORS.headerBg);
            doc.fillColor(COLORS.headerText).fontSize(7).font("Helvetica-Bold");
            let hx = MARGIN_LEFT;
            headers.forEach((h, i) => {
              doc.text(h, hx, y + 6, { width: colWidths[i], align: "center" });
              hx += colWidths[i];
            });
            y += 20;
            doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
          }

          if (idx % 2 === 0) {
            doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 16).fill(COLORS.altRow);
          }

          const values = [
            String(item.assetId || item.registerNumber || ""),
            String(item.equipmentDescription || item.name || ""),
            String(item.bookStock || item.bookStockPreviousYear || 0),
            String(item.purchasesDuringYear || item.purchasedDuringYear || 0),
            String(item.physicalStock || item.actualPhysicalStock || 0),
            String(item.difference || ""),
            String(item.previousBookValue || ""),
            String(item.currentPurchaseValue || ""),
            String(item.currentBookValue || ""),
            String(item.workingCondition || ""),
            String(item.outcome || ""),
          ];

          let tx = MARGIN_LEFT;
          values.forEach((val, i) => {
            const align = ["Book Stock", "Purchases", "Physical Stock", "Difference", "Prev Book Value", "Current Purchase", "Current Book"].includes(headers[i])
              ? "right"
              : "left";
            doc.text(val, tx, y + 3, { width: colWidths[i] - 2, align });
            tx += colWidths[i];
          });
          y += 16;
        });
      } else {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No equipment items recorded", MARGIN_LEFT, y);
        y += 20;
      }

      y += 10;

      // Summary Totals
      if (Array.isArray(data.items) && data.items.length > 0) {
        doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Totals:", MARGIN_LEFT, y);
        const totalBookStock = data.items.reduce((s, i) => s + (Number(i.bookStock) || Number(i.bookStockPreviousYear) || 0), 0);
        const totalPurchases = data.items.reduce((s, i) => s + (Number(i.purchasesDuringYear) || Number(i.purchasedDuringYear) || 0), 0);
        const totalPhysical = data.items.reduce((s, i) => s + (Number(i.physicalStock) || Number(i.actualPhysicalStock) || 0), 0);
        const totalDiff = totalBookStock + totalPurchases - totalPhysical;
        const totalPrevBookValue = data.items.reduce((s, i) => s + (Number(i.previousBookValue) || 0), 0);
        const totalCurrentBook = data.items.reduce((s, i) => s + (Number(i.currentBookValue) || 0), 0);

        let ty = y + 4;
        ty = drawMetaRow(doc, "Total Book Stock", totalBookStock, MARGIN_LEFT, MARGIN_LEFT + 85, ty);
        ty = drawMetaRow(doc, "Total Purchases", totalPurchases, MARGIN_LEFT, MARGIN_LEFT + 85, ty);
        ty = drawMetaRow(doc, "Total Physical Stock", totalPhysical, MARGIN_LEFT, MARGIN_LEFT + 105, ty);
        ty = drawMetaRow(doc, "Total Difference", totalDiff, MARGIN_LEFT, MARGIN_LEFT + 85, ty);
        ty = drawMetaRow(doc, "Total Prev Book Value", formatCurrency(totalPrevBookValue), MARGIN_LEFT, MARGIN_LEFT + 110, ty);
        ty = drawMetaRow(doc, "Total Current Book Value", formatCurrency(totalCurrentBook), MARGIN_LEFT, MARGIN_LEFT + 120, ty);
        y = ty + 10;
      }

      // Verification Remarks
      ensureSpace(doc, 80);
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Verification Remarks:", MARGIN_LEFT, doc.y);
      doc.moveDown(0.3);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text(data.remarks || "No remarks provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Sign-off box
      ensureSpace(doc, 60);
      doc.rect(MARGIN_LEFT, doc.y, CONTENT_WIDTH, 55).fillAndStroke(COLORS.footerBg, COLORS.borderLight);
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Auditor Sign-off", MARGIN_LEFT + 8, doc.y + 8);
      doc.fillColor(COLORS.muted).fontSize(8).font("Helvetica")
        .text("This verification is recorded on Hyperledger Fabric blockchain.", MARGIN_LEFT + 8, doc.y + 10);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica").text("_________________________", MARGIN_LEFT + 210, doc.y + 18);
      doc.text("Audit Officer Signature", MARGIN_LEFT + 210, doc.y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Generate Proforma-II (Equipment Condemnation) PDF
// ---------------------------------------------------------------------------
async function generateProformaIIPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      addFooter(doc, pageNumber);

      drawHeaderBanner(doc, "KONGU ENGINEERING COLLEGE", "Equipment Condemnation - Proforma-II");

      let y = MARGIN_TOP + 55;

      // Metadata section
      const metaFields = [
        ["Record ID", data.recordId || ""],
        ["Financial Year", data.auditYear || new Date().getFullYear()],
        ["Department", data.department || "N/A"],
        ["Asset ID", data.assetId || ""],
        ["Equipment Description", data.equipmentDescription || ""],
        ["Quantity", data.quantity || 1],
        ["Purchase Date", data.purchaseDate ? formatDate(data.purchaseDate) : "N/A"],
        ["Purchase Value", data.purchaseValue ? formatCurrency(data.purchaseValue) : "N/A"],
        ["Book Value", data.bookValue ? formatCurrency(data.bookValue) : "N/A"],
        ["Condition", data.condition || ""],
        ["Status", data.status || "Pending"],
      ];
      let my = y;
      doc.fillColor(COLORS.secondary).fontSize(8.5).font("Helvetica-Bold");
      metaFields.forEach(([label, val]) => {
        my = drawMetaRow(doc, label, val, MARGIN_LEFT, MARGIN_LEFT + 110, my);
      });
      y = my + 5;

      // Reason for Condemnation
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Reason for Condemnation:", MARGIN_LEFT, y);
      doc.moveDown(0.2);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text(data.reason || "No reason provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });
      y = doc.y + 10;

      // Inspection Details
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Inspection Details:", MARGIN_LEFT, y);
      doc.moveDown(0.2);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text(data.inspectionDetails || "No inspection details provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });
      y = doc.y + 10;

      // Loss Details
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Loss Details:", MARGIN_LEFT, y);
      doc.moveDown(0.2);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text(data.lossDetails || "No loss details provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });
      y = doc.y + 10;

      // Repair Cost
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold");
      doc.text("Repair Cost:", MARGIN_LEFT, y);
      doc.fillColor(COLORS.text).fontSize(9).font("Helvetica")
        .text(data.repairCost ? formatCurrency(data.repairCost) : "N/A", MARGIN_LEFT + 65, y);
      y = doc.y + 10;

      // Approval Details
      const approvalFields = [
        ["Requested By", data.requestedBy || ""],
        ["Requested At", data.createdAt ? formatDate(data.createdAt) : "N/A"],
        ["Approved By", data.approvedBy || "N/A"],
        ["Approved At", data.approvedAt ? formatDate(data.approvedAt) : "N/A"],
      ];
      let ay = y;
      doc.fillColor(COLORS.secondary).fontSize(8.5).font("Helvetica-Bold");
      approvalFields.forEach(([label, val]) => {
        ay = drawMetaRow(doc, label, val, MARGIN_LEFT, MARGIN_LEFT + 80, ay);
      });
      y = ay + 5;

      // Items Table
      if (Array.isArray(data.items) && data.items.length > 0) {
        ensureSpace(doc, 200);
        doc.fillColor(COLORS.primary).fontSize(13).font("Helvetica-Bold").text("Condemnation Item Details", MARGIN_LEFT, doc.y);
        y = doc.y + 8;

        const headers = ["Asset ID", "Description", "Quantity", "Book Value (INR)", "Reason", "Condition"];
        const colW = [90, 110, 65, 75, 110, 65];
        const totalW = colW.reduce((a, b) => a + b, 0);

        doc.rect(MARGIN_LEFT, y, totalW, 18).fill(COLORS.headerBg);
        doc.fillColor(COLORS.headerText).fontSize(7).font("Helvetica-Bold");
        let cx = MARGIN_LEFT;
        headers.forEach((h, i) => {
          doc.text(h, cx, y + 4, { width: colW[i], align: "center" });
          cx += colW[i];
        });
        y += 18;

        doc.fillColor(COLORS.text).fontSize(6).font(" Helvetica");
        data.items.forEach((item, idx) => {
          if (y + 16 > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
            doc.addPage();
            pageNumber += 1;
            addFooter(doc, pageNumber);
            y = MARGIN_TOP;
            doc.rect(MARGIN_LEFT, y, totalW, 18).fill(COLORS.headerBg);
            doc.fillColor(COLORS.headerText).fontSize(7).font("Helvetica-Bold");
            let hx = MARGIN_LEFT;
            headers.forEach((h, i) => {
              doc.text(h, hx, y + 4, { width: colW[i], align: "center" });
              hx += colW[i];
            });
            y += 18;
            doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
          }
          if (idx % 2 === 0) {
            doc.rect(MARGIN_LEFT, y, totalW, 14).fill(COLORS.altRow);
          }
          const vals = [
            String(item.assetId || ""),
            String(item.name || item.description || ""),
            String(item.quantity || 1),
            formatCurrency(item.bookValue || item.purchaseValue || 0),
            String(item.reason || ""),
            String(item.condition || ""),
          ];
          let tx = MARGIN_LEFT;
          vals.forEach((v, i) => {
            doc.text(v, tx, y + 2, { width: colW[i] - 2, align: i >= 2 && i <= 3 ? "right" : "left" });
            tx += colW[i];
          });
          y += 14;
        });
      }

      // Remarks
      y = doc.y + 10;
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Remarks:", MARGIN_LEFT, y);
      doc.moveDown(0.2);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text(data.remarks || "No remarks provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Sign-off box
      ensureSpace(doc, 60);
      doc.rect(MARGIN_LEFT, doc.y, CONTENT_WIDTH, 55).fillAndStroke(COLORS.footerBg, COLORS.borderLight);
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Authority Sign-off", MARGIN_LEFT + 8, doc.y + 8);
      doc.fillColor(COLORS.muted).fontSize(8).font("Helvetica")
        .text("This condemnation request is recorded on Hyperledger Fabric blockchain.",
          MARGIN_LEFT + 8, doc.y + 10);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica").text("_________________________", MARGIN_LEFT + 210, doc.y + 18);
      doc.text("Authorized Signatory", MARGIN_LEFT + 210, doc.y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Generate Proforma-III (Consumable Verification) PDF
// ---------------------------------------------------------------------------
async function generateProformaIIIPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      addFooter(doc, pageNumber);

      drawHeaderBanner(doc, "KONGU ENGINEERING COLLEGE", "Consumable Verification - Proforma-III");

      let y = MARGIN_TOP + 55;

      // Metadata section
      const metaFields = [
        ["Record ID", data.recordId || ""],
        ["Financial Year", data.auditYear || new Date().getFullYear()],
        ["Department", data.department || "N/A"],
        ["Laboratory/Section", data.laboratory || "N/A"],
        ["Staff In-Charge", data.staffInCharge || "N/A"],
        ["Verification Date", data.verificationDate || formatDate(data.createdAt)],
        ["Status", data.status || "Completed"],
      ];
      let my = y;
      doc.fillColor(COLORS.secondary).fontSize(8.5).font("Helvetica-Bold");
      metaFields.forEach(([label, val]) => {
        my = drawMetaRow(doc, label, val, MARGIN_LEFT, MARGIN_LEFT + 110, my);
      });
      y = my + 5;

      // Consumable Verification table
      doc.fillColor(COLORS.primary).fontSize(13).font("Helvetica-Bold").text("Consumable Verification Details", MARGIN_LEFT, doc.y);
      y = doc.y + 8;

      const headers = [
        "Consumable ID", "Description", "Previous Stock", "Purchases", "Consumed",
        "Book Stock", "Physical Stock", "Difference", "Purchase Value (INR)", "Current Value (INR)", "Outcome",
      ];
      const numCols = headers.length;
      const colWidth = Math.floor(CONTENT_WIDTH / numCols);
      const colWidths = new Array(numCols).fill(colWidth);
      colWidths[numCols - 1] = CONTENT_WIDTH - colWidth * (numCols - 1);

      doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 20).fill(COLORS.headerBg);
      doc.fillColor(COLORS.headerText).fontSize(6.5).font("Helvetica-Bold");
      let cx = MARGIN_LEFT;
      headers.forEach((h, i) => {
        doc.text(h, cx, y + 5, { width: colWidths[i], align: "center" });
        cx += colWidths[i];
      });
      y += 20;

      if (Array.isArray(data.items) && data.items.length > 0) {
        doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
        data.items.forEach((item, idx) => {
          if (y + 20 > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
            doc.addPage();
            pageNumber += 1;
            addFooter(doc, pageNumber);
            y = MARGIN_TOP;
            doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 20).fill(COLORS.headerBg);
            doc.fillColor(COLORS.headerText).fontSize(6.5).font("Helvetica-Bold");
            let hx = MARGIN_LEFT;
            headers.forEach((h, i) => {
              doc.text(h, hx, y + 5, { width: colWidths[i], align: "center" });
              hx += colWidths[i];
            });
            y += 20;
            doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
          }
          if (idx % 2 === 0) {
            doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 16).fill(COLORS.altRow);
          }
          const values = [
            String(item.consumableId || ""),
            String(item.description || item.name || ""),
            String(item.previousStock || 0),
            String(item.purchasedQuantity || item.purchases || 0),
            String(item.consumedQuantity || 0),
            String(item.remainingBookStock || item.bookStock || 0),
            String(item.actualPhysicalStock || item.physicalStock || 0),
            String(item.difference || ""),
            formatCurrency(item.purchaseValue || 0),
            formatCurrency(item.currentValue || item.bookValue || 0),
            String(item.outcome || ""),
          ];
          let tx = MARGIN_LEFT;
          values.forEach((val, i) => {
            doc.text(val, tx, y + 3, { width: colWidths[i] - 2, align: "left" });
            tx += colWidths[i];
          });
          y += 16;
        });
      } else {
        doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica").text("No consumable items recorded", MARGIN_LEFT, y);
        y += 20;
      }

      y += 10;
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Verification Remarks:", MARGIN_LEFT, y);
      doc.moveDown(0.3);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text(data.remarks || "No remarks provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      ensureSpace(doc, 60);
      doc.rect(MARGIN_LEFT, doc.y, CONTENT_WIDTH, 55).fillAndStroke(COLORS.footerBg, COLORS.borderLight);
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Auditor Sign-off", MARGIN_LEFT + 8, doc.y + 8);
      doc.fillColor(COLORS.muted).fontSize(8).font("Helvetica")
        .text("This verification is recorded on Hyperledger Fabric blockchain.", MARGIN_LEFT + 8, doc.y + 10);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica").text("_________________________", MARGIN_LEFT + 210, doc.y + 18);
      doc.text("Audit Officer Signature", MARGIN_LEFT + 210, doc.y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Generate Proforma-IV (Consumable Condemnation) PDF
// ---------------------------------------------------------------------------
async function generateProformaIVPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      let pageNumber = 1;
      addFooter(doc, pageNumber);

      drawHeaderBanner(doc, "KONGU ENGINEERING COLLEGE", "Consumable Condemnation - Proforma-IV");

      let y = MARGIN_TOP + 55;

      const metaFields = [
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
        ["Purchase Date", data.purchaseDate ? formatDate(data.purchaseDate) : "N/A"],
        ["Book Value", data.bookValue ? formatCurrency(data.bookValue) : "N/A"],
        ["Status", data.status || "Pending"],
      ];
      let my = y;
      doc.fillColor(COLORS.secondary).fontSize(8.5).font("Helvetica-Bold");
      metaFields.forEach(([label, val]) => {
        my = drawMetaRow(doc, label, val, MARGIN_LEFT, MARGIN_LEFT + 110, my);
      });
      y = my + 5;

      // Condemnation/Loss Reason
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Condemnation/Loss Reason:", MARGIN_LEFT, y);
      doc.moveDown(0.2);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text(data.reason || "No reason provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });
      y = doc.y + 10;

      // Verification Details
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Verification Details:", MARGIN_LEFT, y);
      doc.moveDown(0.2);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text(data.verificationDetails || "No verification details provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });
      y = doc.y + 10;

      // Approval Details
      const approvalFields = [
        ["Requested By", data.requestedBy || ""],
        ["Requested At", data.createdAt ? formatDate(data.createdAt) : "N/A"],
        ["Approved By", data.approvedBy || "N/A"],
        ["Approved At", data.approvedAt ? formatDate(data.approvedAt) : "N/A"],
      ];
      let ay = y;
      doc.fillColor(COLORS.secondary).fontSize(8.5).font("Helvetica-Bold");
      approvalFields.forEach(([label, val]) => {
        ay = drawMetaRow(doc, label, val, MARGIN_LEFT, MARGIN_LEFT + 80, ay);
      });
      y = ay + 5;

      // Items Table
      if (Array.isArray(data.items) && data.items.length > 0) {
        ensureSpace(doc, 200);
        doc.fillColor(COLORS.primary).fontSize(13).font("Helvetica-Bold").text("Condemnation Item Details", MARGIN_LEFT, doc.y);
        y = doc.y + 8;

        const headers = ["Consumable ID", "Description", "Book Stock", "Physical Stock", "Difference", "Reason"];
        const colW = [85, 130, 65, 70, 60, 105];
        const totalW = colW.reduce((a, b) => a + b, 0);

        doc.rect(MARGIN_LEFT, y, totalW, 18).fill(COLORS.headerBg);
        doc.fillColor(COLORS.headerText).fontSize(7).font("Helvetica-Bold");
        let cx = MARGIN_LEFT;
        headers.forEach((h, i) => {
          doc.text(h, cx, y + 4, { width: colW[i], align: "center" });
          cx += colW[i];
        });
        y += 18;

        doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
        data.items.forEach((item, idx) => {
          if (y + 16 > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
            doc.addPage();
            pageNumber += 1;
            addFooter(doc, pageNumber);
            y = MARGIN_TOP;
            doc.rect(MARGIN_LEFT, y, totalW, 18).fill(COLORS.headerBg);
            doc.fillColor(COLORS.headerText).fontSize(7).font("Helvetica-Bold");
            let hx = MARGIN_LEFT;
            headers.forEach((h, i) => {
              doc.text(h, hx, y + 4, { width: colW[i], align: "center" });
              hx += colW[i];
            });
            y += 18;
            doc.fillColor(COLORS.text).fontSize(6).font("Helvetica");
          }
          if (idx % 2 === 0) {
            doc.rect(MARGIN_LEFT, y, totalW, 14).fill(COLORS.altRow);
          }
          const vals = [
            String(item.consumableId || ""),
            String(item.description || item.name || ""),
            String(item.bookStock || ""),
            String(item.actualStock || item.physicalStock || ""),
            String(item.difference || ""),
            String(item.reason || ""),
          ];
          let tx = MARGIN_LEFT;
          vals.forEach((v, i) => {
            doc.text(v, tx, y + 2, { width: colW[i] - 2, align: i >= 2 && i <= 4 ? "right" : "left" });
            tx += colW[i];
          });
          y += 14;
        });
      }

      // Remarks
      y = doc.y + 10;
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Remarks:", MARGIN_LEFT, y);
      doc.moveDown(0.2);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica")
        .text(data.remarks || "No remarks provided.", MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH, align: "left" });

      // Sign-off box
      ensureSpace(doc, 60);
      doc.rect(MARGIN_LEFT, doc.y, CONTENT_WIDTH, 55).fillAndStroke(COLORS.footerBg, COLORS.borderLight);
      doc.fillColor(COLORS.secondary).fontSize(9).font("Helvetica-Bold").text("Authority Sign-off", MARGIN_LEFT + 8, doc.y + 8);
      doc.fillColor(COLORS.muted).fontSize(8).font("Helvetica")
        .text("This condemnation request is recorded on Hyperledger Fabric blockchain.",
          MARGIN_LEFT + 8, doc.y + 10);
      doc.fillColor(COLORS.text).fontSize(8).font("Helvetica").text("_________________________", MARGIN_LEFT + 210, doc.y + 18);
      doc.text("Authorized Signatory", MARGIN_LEFT + 210, doc.y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Excel generators for Proformas II, III, IV
// ---------------------------------------------------------------------------

/**
 * Generate Excel buffer for Proforma-II (Equipment Condemnation)
 */
async function generateProformaIIExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Proforma-II - Equipment Condemnation');
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
  const sheet = workbook.addWorksheet('Proforma-III - Consumable Verification');
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
  const sheet = workbook.addWorksheet('Proforma-IV - Consumable Condemnation');
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

// ---------------------------------------------------------------------------
// Generate Audit Report Excel buffer
// ---------------------------------------------------------------------------
/**
 * Generate an Excel buffer for an audit report
 */
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

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------
module.exports = {
  generatePdfBuffer,
  generateExcelBuffer,
  generateProformaIPdf,
  generateProformaIIPdf,
  generateProformaIIIPdf,
  generateProformaIVPdf,
  generateProformaIIExcel,
  generateProformaIIIExcel,
  generateProformaIVExcel,
};
