const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

/**
 * Generate a PDF buffer for an audit report
 */
async function generatePdfBuffer(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // Header Banner
      doc
        .rect(40, 40, 515, 60)
        .fill("#1e40af");
      
      doc
        .fillColor("#ffffff")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("CHAINTRACK ASSET MANAGEMENT", 55, 52);
      
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(`Annual Audit & Inventory Report (${reportData.year || new Date().getFullYear()})`, 55, 76);

      doc.moveDown(2);
      let y = 115;

      // Metadata Box
      doc
        .rect(40, y, 515, 55)
        .fillAndStroke("#f8fafc", "#cbd5e1");

      doc
        .fillColor("#0f172a")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`Report ID: `, 50, y + 10)
        .font("Helvetica")
        .text(reportData.reportId || `REP-${reportData.year}`, 110, y + 10);

      doc
        .font("Helvetica-Bold")
        .text(`Audit Officer: `, 50, y + 25)
        .font("Helvetica")
        .text(reportData.auditOfficer || "Administrator", 125, y + 25);

      doc
        .font("Helvetica-Bold")
        .text(`Audit Period: `, 300, y + 10)
        .font("Helvetica")
        .text(reportData.auditPeriod || `FY ${reportData.year || new Date().getFullYear()}`, 375, y + 10);

      doc
        .font("Helvetica-Bold")
        .text(`Generated On: `, 300, y + 25)
        .font("Helvetica")
        .text(new Date(reportData.auditDate || Date.now()).toLocaleDateString(), 380, y + 25);

      y += 70;

      // Executive Summary KPIs Table
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1e3a8a")
        .text("1. Executive Asset Summary", 40, y);

      y += 20;

      const kpis = [
        { label: "Total Asset Count", value: String(reportData.totalAssets || 0) },
        { label: "Portfolio Value", value: `$${Number(reportData.totalPurchaseValue || 0).toLocaleString()}` },
        { label: "Active Assets", value: String(reportData.activeAssets || 0) },
        { label: "Under Maintenance", value: String(reportData.maintenanceAssets || 0) },
        { label: "Condemned Assets", value: String(reportData.condemnedAssets || 0) },
        { label: "Disposed / Retired", value: String(reportData.disposedAssets || 0) }
      ];

      doc.rect(40, y, 515, 60).fillAndStroke("#ffffff", "#e2e8f0");
      kpis.forEach((kpi, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const cellX = 50 + col * 170;
        const cellY = y + 8 + row * 26;

        doc
          .fillColor("#64748b")
          .fontSize(8)
          .font("Helvetica")
          .text(kpi.label, cellX, cellY);

        doc
          .fillColor("#0f172a")
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(kpi.value, cellX, cellY + 10);
      });

      y += 75;

      // Department Breakdown
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1e3a8a")
        .text("2. Departmental Breakdown", 40, y);

      y += 20;

      // Table Header
      doc.rect(40, y, 515, 20).fill("#f1f5f9");
      doc.fillColor("#334155").fontSize(9).font("Helvetica-Bold");
      doc.text("Department", 50, y + 5);
      doc.text("Asset Count", 250, y + 5);
      doc.text("Total Value", 420, y + 5);

      y += 20;
      const deptSummary = reportData.departmentSummary || {};
      const deptKeys = Object.keys(deptSummary);

      if (deptKeys.length === 0) {
        doc.fillColor("#64748b").fontSize(9).font("Helvetica").text("No department summary available", 50, y + 5);
        y += 20;
      } else {
        deptKeys.forEach((dept) => {
          const item = typeof deptSummary[dept] === "object" ? deptSummary[dept] : { count: deptSummary[dept], totalValue: 0 };
          doc.rect(40, y, 515, 18).stroke("#e2e8f0");
          doc.fillColor("#0f172a").fontSize(9).font("Helvetica");
          doc.text(dept, 50, y + 4);
          doc.text(String(item.count || 0), 250, y + 4);
          doc.text(`$${Number(item.totalValue || 0).toLocaleString()}`, 420, y + 4);
          y += 18;
        });
      }

      y += 20;

      // Category Breakdown
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1e3a8a")
        .text("3. Category Summary", 40, y);

      y += 20;

      doc.rect(40, y, 515, 20).fill("#f1f5f9");
      doc.fillColor("#334155").fontSize(9).font("Helvetica-Bold");
      doc.text("Category", 50, y + 5);
      doc.text("Asset Count", 250, y + 5);
      doc.text("Total Value", 420, y + 5);

      y += 20;
      const catSummary = reportData.categorySummary || {};
      const catKeys = Object.keys(catSummary);

      if (catKeys.length === 0) {
        doc.fillColor("#64748b").fontSize(9).font("Helvetica").text("No category summary available", 50, y + 5);
        y += 20;
      } else {
        catKeys.forEach((cat) => {
          const item = typeof catSummary[cat] === "object" ? catSummary[cat] : { count: catSummary[cat], totalValue: 0 };
          doc.rect(40, y, 515, 18).stroke("#e2e8f0");
          doc.fillColor("#0f172a").fontSize(9).font("Helvetica");
          doc.text(cat, 50, y + 4);
          doc.text(String(item.count || 0), 250, y + 4);
          doc.text(`$${Number(item.totalValue || 0).toLocaleString()}`, 420, y + 4);
          y += 18;
        });
      }

      // Detailed Asset Table if provided
      if (Array.isArray(reportData.assetsList) && reportData.assetsList.length > 0) {
        doc.addPage();
        let pageY = 40;
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#1e3a8a")
          .text("4. Asset Registry Details", 40, pageY);

        pageY += 25;
        doc.rect(40, pageY, 515, 20).fill("#1e40af");
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
        doc.text("Asset ID", 45, pageY + 6);
        doc.text("Name", 125, pageY + 6);
        doc.text("Department", 275, pageY + 6);
        doc.text("Category", 355, pageY + 6);
        doc.text("Status", 435, pageY + 6);
        doc.text("Value ($)", 495, pageY + 6);

        pageY += 20;
        reportData.assetsList.forEach((ast) => {
          if (pageY > 750) {
            doc.addPage();
            pageY = 40;
          }
          doc.rect(40, pageY, 515, 18).stroke("#f1f5f9");
          doc.fillColor("#0f172a").fontSize(8).font("Helvetica");
          doc.text(ast.assetId || "", 45, pageY + 4, { width: 75, ellipsis: "..." });
          doc.text(ast.name || "", 125, pageY + 4, { width: 145, ellipsis: "..." });
          doc.text(ast.department || "", 275, pageY + 4, { width: 75, ellipsis: "..." });
          doc.text(ast.category || "", 355, pageY + 4, { width: 75, ellipsis: "..." });
          doc.text(ast.status || "", 435, pageY + 4, { width: 55, ellipsis: "..." });
          doc.text(Number(ast.purchaseValue || 0).toLocaleString(), 495, pageY + 4);
          pageY += 18;
        });
      }

      // Footer / Signatures
      if (y > 650) {
        doc.addPage();
        y = 40;
      } else {
        y += 40;
      }

      doc.rect(40, y, 515, 80).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold").text("Audit Sign-off & Blockchain Verification", 50, y + 10);
      doc.fillColor("#64748b").fontSize(8).font("Helvetica").text("This document is verified and recorded on the Hyperledger Fabric ledger.", 50, y + 25);

      doc.text("_________________________", 60, y + 60);
      doc.text("Audit Officer Signature", 60, y + 68);

      doc.text("_________________________", 350, y + 60);
      doc.text("Department Head Approval", 350, y + 68);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

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
    { metric: "Total Portfolio Value ($)", value: reportData.totalPurchaseValue || 0 },
    { metric: "Active Assets", value: reportData.activeAssets || 0 },
    { metric: "Maintenance Assets", value: reportData.maintenanceAssets || 0 },
    { metric: "Condemned Assets", value: reportData.condemnedAssets || 0 },
    { metric: "Disposed / Retired Assets", value: reportData.disposedAssets || 0 }
  ]);

  // Department Breakdown section
  summarySheet.addRow([]);
  const deptHeaderRow = summarySheet.addRow(["Department Breakdown", "Asset Count", "Total Value ($)"]);
  deptHeaderRow.font = { bold: true };
  
  const deptSummary = reportData.departmentSummary || {};
  Object.keys(deptSummary).forEach((dept) => {
    const item = typeof deptSummary[dept] === "object" ? deptSummary[dept] : { count: deptSummary[dept], totalValue: 0 };
    summarySheet.addRow([dept, item.count || 0, item.totalValue || 0]);
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
      { header: "Purchase Value ($)", key: "purchaseValue", width: 18 },
      { header: "Serial Number", key: "serialNumber", width: 20 }
    ];

    assetSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
    assetSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E40AF" } };

    reportData.assetsList.forEach((ast) => {
      assetSheet.addRow({
        assetId: ast.assetId,
        name: ast.name,
        category: ast.category,
        department: ast.department,
        status: ast.status,
        location: ast.location || "",
        purchaseDate: ast.purchaseDate || "",
        purchaseValue: ast.purchaseValue || 0,
        serialNumber: ast.serialNumber || ""
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  generatePdfBuffer,
  generateExcelBuffer
};
