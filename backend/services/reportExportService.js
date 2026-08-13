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
        { label: "Portfolio Value", value: `INR ${Number(reportData.totalPurchaseValue || 0).toLocaleString()}` },
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
          doc.text(`INR ${Number(item.totalValue || 0).toLocaleString()}`, 420, y + 4);
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
          doc.text(`INR ${Number(item.totalValue || 0).toLocaleString()}`, 420, y + 4);
          y += 18;
        });
      }

      // Bills Summary
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1e3a8a")
        .text("4. Financial / Bills Summary", 40, y);

      y += 20;

      doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold");
      doc.text(`Total Bills`, 50, y);
      doc.fillColor("#1e40af").text(String(reportData.totalBills || 0), 200, y);
      y += 18;
      doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold");
      doc.text(`Total Bill Value`, 50, y);
      doc.fillColor("#1e40af").text(`INR ${Number(reportData.totalBillValue || 0).toLocaleString()}`, 200, y);
      y += 40;

      // Maintenance Summary
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1e3a8a")
        .text("5. Maintenance Summary", 40, y);

      y += 20;

      doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold");
      doc.text(`Total Maintenance Records`, 50, y);
      doc.fillColor("#1e40af").text(String(reportData.totalMaintenance || 0), 200, y);
      y += 40;

      // Transfers Summary
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1e3a8a")
        .text("6. Transfers Summary", 40, y);

      y += 20;

      doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold");
      doc.text(`Total Transfers`, 50, y);
      doc.fillColor("#1e40af").text(String(reportData.totalTransfers || 0), 200, y);
      y += 40;

      // Detailed Asset Table if provided
      if (Array.isArray(reportData.assetsList) && reportData.assetsList.length > 0) {
        doc.addPage();
        let pageY = 40;
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#1e3a8a")
          .text("7. Asset Registry Details", 40, pageY);

        pageY += 25;
        doc.rect(40, pageY, 515, 20).fill("#1e40af");
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
        doc.text("Asset ID", 45, pageY + 6);
        doc.text("Name", 125, pageY + 6);
        doc.text("Department", 275, pageY + 6);
        doc.text("Category", 355, pageY + 6);
        doc.text("Status", 435, pageY + 6);
        doc.text("Value (INR )", 495, pageY + 6);

        pageY += 20;
        reportData.assetsList.forEach((ast) => {
          if (pageY > 750) {
            doc.addPage();
            pageY = 40;
          }
          doc.rect(40, pageY, 515, 18).stroke("#f1f5f9");
          doc.fillColor("#0f172a").fontSize(8).font("Helvetica");
          doc.text(String(ast.assetId || ""), 45, pageY + 4, { width: 75 });
          doc.text(String(ast.name || ""), 125, pageY + 4, { width: 145 });
          doc.text(String(ast.department || ""), 275, pageY + 4, { width: 75 });
          doc.text(String(ast.category || ""), 355, pageY + 4, { width: 75 });
          doc.text(String(ast.status || ""), 435, pageY + 4, { width: 55 });
          doc.text(Number(ast.purchaseValue || 0).toLocaleString(), 495, pageY + 4);
          pageY += 18;
        });
      }

      // Bills Detail Table
      if (Array.isArray(reportData.billsList) && reportData.billsList.length > 0) {
        doc.addPage();
        let billY = 40;
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#1e3a8a")
          .text("8. Bills / Purchase Records", 40, billY);

        billY += 25;
        doc.rect(40, billY, 515, 20).fill("#1e40af");
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
        doc.text("Bill ID", 45, billY + 6);
        doc.text("Asset ID", 145, billY + 6);
        doc.text("Vendor", 245, billY + 6);
        doc.text("Invoice", 365, billY + 6);
        doc.text("Amount (INR)", 445, billY + 6);
        doc.text("Status", 500, billY + 6);

        billY += 20;
        reportData.billsList.forEach((bill) => {
          if (billY > 750) { doc.addPage(); billY = 40; }
          doc.rect(40, billY, 515, 18).stroke("#f1f5f9");
          doc.fillColor("#0f172a").fontSize(7).font("Helvetica");
          doc.text(String(bill.billId || bill.id || ""), 45, billY + 4, { width: 95 });
          doc.text(String(bill.assetId || ""), 145, billY + 4, { width: 95 });
          doc.text(String(bill.vendor || ""), 245, billY + 4, { width: 115 });
          doc.text(String(bill.invoiceNumber || ""), 365, billY + 4, { width: 75 });
          doc.text(Number(bill.amount || 0).toLocaleString(), 445, billY + 4);
          doc.text(String(bill.paymentStatus || "Paid"), 500, billY + 4);
          billY += 18;
        });
      }

      // Transfers Detail Table
      if (Array.isArray(reportData.transfersList) && reportData.transfersList.length > 0) {
        doc.addPage();
        let trY = 40;
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#1e3a8a")
          .text("9. Asset Transfers", 40, trY);

        trY += 25;
        doc.rect(40, trY, 515, 20).fill("#1e40af");
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
        doc.text("Transfer ID", 45, trY + 6);
        doc.text("Asset ID", 145, trY + 6);
        doc.text("From Dept", 255, trY + 6);
        doc.text("To Dept", 335, trY + 6);
        doc.text("Date", 425, trY + 6);
        doc.text("Status", 485, trY + 6);

        trY += 20;
        reportData.transfersList.forEach((tr) => {
          if (trY > 750) { doc.addPage(); trY = 40; }
          doc.rect(40, trY, 515, 18).stroke("#f1f5f9");
          doc.fillColor("#0f172a").fontSize(7).font("Helvetica");
          doc.text(String(tr.transferId || ""), 45, trY + 4, { width: 95 });
          doc.text(String(tr.assetId || ""), 145, trY + 4, { width: 105 });
          doc.text(String(tr.fromDepartment || ""), 255, trY + 4, { width: 75 });
          doc.text(String(tr.toDepartment || ""), 335, trY + 4, { width: 85 });
          doc.text(String(tr.date || tr.createdAt || ""), 425, trY + 4, { width: 55 });
          doc.text(String(tr.status || "Completed"), 485, trY + 4);
          trY += 18;
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
    { metric: "Total Portfolio Value (₹)", value: reportData.totalPurchaseValue || 0 },
    { metric: "Active Assets", value: reportData.activeAssets || 0 },
    { metric: "Maintenance Assets", value: reportData.maintenanceAssets || 0 },
    { metric: "Condemned Assets", value: reportData.condemnedAssets || 0 },
    { metric: "Disposed / Retired Assets", value: reportData.disposedAssets || 0 }
  ]);

  // Department Breakdown section
  summarySheet.addRow([]);
  const deptHeaderRow = summarySheet.addRow(["Department Breakdown", "Asset Count", "Total Value (₹)"]);
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
      { header: "Purchase Value (₹)", key: "purchaseValue", width: 18 },
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

  // Sheet 3: Bills / Purchase Records
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
        billId: bill.billId || bill.id || "",
        assetId: bill.assetId || "",
        vendor: bill.vendor || "",
        invoiceNumber: bill.invoiceNumber || "",
        amount: bill.amount || 0,
        paymentStatus: bill.paymentStatus || "Paid"
      });
    });
  }

  // Sheet 4: Transfers
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
        transferId: tr.transferId || "",
        assetId: tr.assetId || "",
        fromDepartment: tr.fromDepartment || "",
        toDepartment: tr.toDepartment || "",
        date: tr.date || tr.createdAt || "",
        status: tr.status || "Completed"
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Generate a PDF buffer for Proforma-I (Equipment Verification)
 */
async function generateProformaIPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.rect(40, 40, 515, 60).fill('#1e40af');
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('KONGU ENGINEERING COLLEGE', 55, 52);
      doc.fontSize(11).font('Helvetica').text('Departmental Stock Verification - Proforma-I', 55, 72);

      doc.fillColor('#000000').fontSize(10).font('Helvetica');
      const metaY = 110;
      doc.text(`Financial Year: ${data.auditYear || new Date().getFullYear()}`, 50, metaY);
      doc.text(`Department: ${data.department || ''}`, 50, metaY + 14);
      doc.text(`Laboratory/Workshop: ${data.laboratory || data.workshop || ''}`, 50, metaY + 28);
      doc.text(`Staff In-Charge: ${data.staffInCharge || ''}`, 50, metaY + 42);
      doc.text(`Verification Date: ${data.verificationDate || new Date().toISOString().split('T')[0]}`, 50, metaY + 56);

      doc.moveDown(4);
      let y = doc.y;

      if (Array.isArray(data.items) && data.items.length > 0) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e3a8a').text('Equipment Verification Details', 40, y);
        y += 25;

        doc.rect(40, y, 515, 20).fill('#f1f5f9');
        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
        const headers = ['Asset/Register No', 'Equipment Description', 'Book Stock', 'Purchases', 'Physical Stock', 'Difference', 'Prev Book Value', 'Current Purchase', 'Current Book', 'Working Condition', 'Outcome'];
        let x = 45;
        headers.forEach((h, i) => {
          doc.text(h, x, y + 5, { width: 42, align: 'center' });
          x += 42;
        });
        y += 20;

        doc.fillColor('#0f172a').fontSize(7).font('Helvetica');
        data.items.forEach(item => {
          x = 45;
          doc.text(String(item.assetId || item.registerNumber || ''), x, y + 1, { width: 42 });
          x += 42;
          doc.text(String(item.equipmentDescription || item.name || ''), x, y + 1, { width: 42 });
          x += 42;
          doc.text(String(item.bookStock || item.bookStockPreviousYear || 0), x, y + 1, { width: 42, align: 'right' });
          x += 42;
          doc.text(String(item.purchasesDuringYear || item.purchasedDuringYear || 0), x, y + 1, { width: 42, align: 'right' });
          x += 42;
          doc.text(String(item.physicalStock || item.actualPhysicalStock || 0), x, y + 1, { width: 42, align: 'right' });
          x += 42;
          doc.text(String(item.difference || ''), x, y + 1, { width: 42, align: 'right' });
          x += 42;
          doc.text(String(item.previousBookValue || ''), x, y + 1, { width: 42, align: 'right' });
          x += 42;
          doc.text(String(item.currentPurchaseValue || ''), x, y + 1, { width: 42, align: 'right' });
          x += 42;
          doc.text(String(item.currentBookValue || ''), x, y + 1, { width: 42, align: 'right' });
          x += 42;
          doc.text(String(item.workingCondition || ''), x, y + 1, { width: 42 });
          x += 42;
          doc.text(String(item.outcome || ''), x, y + 1, { width: 42 });
          y += 14;
        });
      } else {
        doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('No equipment items recorded', 50, y);
        y += 20;
      }

      y += 20;
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Verification Remarks:', 40, y);
      y += 14;
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(data.remarks || 'No remarks', 45, y, { width: 500 });
      y += 40;

      doc.rect(40, y, 515, 50).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Auditor Sign-off', 50, y + 8);
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('This verification is recorded on Hyperledger Fabric blockchain.', 50, y + 24);
      doc.text('_________________________', 320, y + 38);
      doc.text('Audit Officer Signature', 320, y + 46);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate Excel buffers for Proformas II, III, IV
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

  // If items array exists, add a detailed table
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

module.exports = {
  generatePdfBuffer,
  generateExcelBuffer,
  generateProformaIPdf,
  generateProformaIIExcel,
  generateProformaIIIExcel,
  generateProformaIVExcel
};
