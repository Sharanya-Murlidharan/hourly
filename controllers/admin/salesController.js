const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');

// Render sales report page with paginated data
const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, page = 1 } = req.query;
    const currentPage = parseInt(page);
    const limit = 5;
    const skip = (currentPage - 1) * limit;

    // Build the query for filtering orders by date range and Delivered status
    let dateFilter = { status: "Delivered" };
    if (startDate && endDate) {
      const startDateObj = moment(startDate, 'DD-MM-YYYY').startOf('day').toDate();
      const endDateObj = moment(endDate, 'DD-MM-YYYY').endOf('day').toDate();
      dateFilter.createdOn = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    }

    // Get total number of orders for pagination
    const totalOrdersCount = await Order.countDocuments(dateFilter);
    const totalPages = Math.ceil(totalOrdersCount / limit);

    // Fetch orders for the current page
    const orders = await Order.find(dateFilter)
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate summary stats (based on all Delivered orders)
    const allOrders = await Order.find(dateFilter);
    const sales = allOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    const couponsRedeemed = allOrders.reduce((sum, order) => sum + (order.couponApplied ? order.couponDiscount : 0), 0);
    const discounts = allOrders.reduce((sum, order) => sum + order.discount, 0);
    const cancelledOrRefunded = 0; // Delivered orders cannot be Canceled or Returned
    const grossSales = sales + (discounts + couponsRedeemed)
    const netSales = grossSales - (discounts + couponsRedeemed);
    const totalOrders = totalOrdersCount;
  
    // Format orders for the table
    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      amount: order.totalPrice + order.discount + order.couponDiscount,
      discount: order.discount,
      coupon: order.couponDiscount,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      returnOrCancelled: 0, // Delivered orders have no return/cancellation
      date: order.createdOn.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      status: order.status,
    }));

    // Render the sales report page with the data
    res.render('sales', {
      grossSales,
      couponsRedeemed,
      discounts,
      cancelledOrRefunded,
      netSales,
      totalOrders,
      orders: formattedOrders,
      startDate: startDate || '',
      endDate: endDate || '',
      currentPage,
      totalPages,
    });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

// Fetch sales data for Fetch API (dynamic updates)
const getSalesData = async (req, res, next) => {
  try {
    const { startDate, endDate, range, page = 1 } = req.query;
    const currentPage = parseInt(page);
    const limit = 5;
    const skip = (currentPage - 1) * limit;
    let dateFilter = { status: "Delivered" };

    // Handle date range
    if (range === 'custom' && startDate && endDate) {
      const startDateObj = moment(startDate, 'DD-MM-YYYY').startOf('day').toDate();
      const endDateObj = moment(endDate, 'DD-MM-YYYY').endOf('day').toDate();
      dateFilter.createdOn = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    } else if (range) {
      const today = moment().startOf('day');
      switch (range) {
        case 'today':
          dateFilter.createdOn = {
            $gte: today.toDate(),
            $lte: today.endOf('day').toDate(),
          };
          break;
        case 'yesterday':
          dateFilter.createdOn = {
            $gte: today.subtract(1, 'days').startOf('day').toDate(),
            $lte: today.endOf('day').toDate(),
          };
          break;
        case 'last7days':
          dateFilter.createdOn = {
            $gte: today.subtract(6, 'days').startOf('day').toDate(),
            $lte: moment().endOf('day').toDate(),
          };
          break;
        case 'last30days':
          dateFilter.createdOn = {
            $gte: today.subtract(29, 'days').startOf('day').toDate(),
            $lte: moment().endOf('day').toDate(),
          };
          break;
        case 'thisMonth':
          dateFilter.createdOn = {
            $gte: today.startOf('month').toDate(),
            $lte: today.endOf('month').toDate(),
          };
          break;
        case 'lastMonth':
          dateFilter.createdOn = {
            $gte: today.subtract(1, 'month').startOf('month').toDate(),
            $lte: today.subtract(1, 'month').endOf('month').toDate(),
          };
          break;
        case 'thisYear':
          dateFilter.createdOn = {
            $gte: today.startOf('year').toDate(),
            $lte: today.endOf('year').toDate(),
          };
          break;
        default:
          // No range filter, include all Delivered orders
          break;
      }
    }

    // Get total number of orders for pagination
    const totalOrdersCount = await Order.countDocuments(dateFilter);
    const totalPages = Math.ceil(totalOrdersCount / limit);

    // Fetch paginated orders
    const orders = await Order.find(dateFilter)
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate summary stats (based on all Delivered orders)
    const allOrders = await Order.find(dateFilter);
const sales = allOrders.reduce((sum, order) => sum + order.totalPrice, 0);
const discounts = allOrders.reduce((sum, order) => sum + order.discount, 0);
const couponsRedeemed = allOrders.reduce((sum, order) => sum + (order.couponApplied ? order.couponDiscount : 0), 0);

const summary = {
  cancelledOrRefunded: 0, // Delivered orders cannot be Canceled or Returned
  couponsRedeemed,
  discounts,
  grossSales: sales + discounts + couponsRedeemed,
  netSales: (sales + discounts + couponsRedeemed) - (discounts + couponsRedeemed),
  totalOrders: totalOrdersCount
};



    // Format orders for table
    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      amount: order.totalPrice,
      discount: order.discount,
      coupon: order.couponDiscount,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      returnOrCancelled: 0, // Delivered orders have no return/cancellation
      date: order.createdOn.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      status: order.status,
    }));

    res.json({
      success: true,
      summary,
      orders: formattedOrders,
      currentPage,
      totalPages,
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
    error.statusCode = 500;
    next(error);
  }
};

// PDF Report Generator with Fixed Alignment
const generatePDFReport = async (req, res, next) => {
  try {
    const { startDate, endDate, range } = req.query;

    // Mock res.json to reuse getSalesData logic (fetch all orders, no pagination)
    let data;
    await getSalesData(
      { query: { startDate, endDate, range, page: 1, limit: Infinity } }, // Override pagination
      {
        json: (result) => {
          data = result;
        },
      }
    );

    // Recalculate summary based on provided logic
    const allOrders = data.orders || [];
    const totalOrdersCount = allOrders.length;
    const sales = allOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
    const discounts = allOrders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const couponsRedeemed = allOrders.reduce((sum, order) => sum + (order.coupon || 0), 0);
    
    const summary = {
      cancelledOrRefunded: 0, // Delivered orders cannot be Canceled or Returned
      couponsRedeemed,
      discounts,
      grossSales: sales + discounts + couponsRedeemed,
      netSales: (sales + discounts + couponsRedeemed) - (discounts + couponsRedeemed),
      totalOrders: totalOrdersCount
    };

    const doc = new PDFDocument({ 
      margin: 50,
      layout: 'landscape',
      size: 'A4'
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales_report_${moment().format('YYYYMMDD')}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('HOURLY Sales Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Date Range: ${startDate && endDate ? startDate + ' to ' + endDate : 'All Data'}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Gross Sales: Rs. ${(summary.grossSales || 0).toLocaleString('en-IN')}`);
    doc.text(`Cancelled/Refunded: Rs. ${(summary.cancelledOrRefunded || 0).toLocaleString('en-IN')}`);
    doc.text(`Coupons Redeemed: Rs. ${(summary.couponsRedeemed || 0).toLocaleString('en-IN')}`);
    doc.text(`Discounts: Rs. ${(summary.discounts || 0).toLocaleString('en-IN')}`);
    doc.text(`Net Sales: Rs. ${(summary.netSales || 0).toLocaleString('en-IN')}`);
    doc.text(`Total Orders: ${(summary.totalOrders || 0).toLocaleString('en-IN')}`);
    doc.moveDown(2);

    // Table Configuration - Fixed alignment
    doc.fontSize(14).font('Helvetica-Bold').text('Orders', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const tableHeaders = ['Order ID', 'Amount', 'Discount', 'Coupon', 'Final Amount', 'Return/Cancelled', 'Payment', 'Date', 'Status'];
    const columnWidths = [90, 80, 80, 80, 90, 100, 90, 90, 80];
    const rowHeight = 25;
    const startX = 30; // Reduced margin for more space
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);

    // Draw outer table border
    doc.rect(startX, tableTop, tableWidth, rowHeight).stroke();

    // Draw table headers with proper alignment
    doc.fontSize(10).font('Helvetica-Bold');
    let currentX = startX;
    
    tableHeaders.forEach((header, i) => {
      // Draw vertical line before each column (except first)
      if (i > 0) {
        doc.moveTo(currentX, tableTop).lineTo(currentX, tableTop + rowHeight).stroke();
      }
      
      // Draw header text centered in column
      doc.text(header, currentX + 3, tableTop + 8, { 
        width: columnWidths[i] - 6, 
        align: 'center',
        ellipsis: true
      });
      
      currentX += columnWidths[i];
    });

    // Draw final vertical line
    doc.moveTo(currentX, tableTop).lineTo(currentX, tableTop + rowHeight).stroke();

    // Draw table data rows
    doc.fontSize(9).font('Helvetica');
    allOrders.forEach((order, index) => {
      const y = tableTop + rowHeight + (index * rowHeight);
      
      // Draw row border
      doc.rect(startX, y, tableWidth, rowHeight).stroke();
      
      // Prepare row data
      const rowData = [
        order.orderId || 'N/A',
        `Rs.${(order.amount + order.discount +  order.coupon|| 0).toLocaleString('en-IN')}`,
        `Rs.${(order.discount || 0).toLocaleString('en-IN')}`,
        `Rs.${(order.coupon || 0).toLocaleString('en-IN')}`,
        `Rs.${(order.finalAmount || 0).toLocaleString('en-IN')}`,
        `Rs.${(order.returnOrCancelled || 0).toLocaleString('en-IN')}`,
        order.paymentMethod || 'N/A',
        order.date || 'N/A',
        order.status || 'N/A'
      ];

      // Draw each cell with proper alignment
      currentX = startX;
      rowData.forEach((cellData, cellIndex) => {
        // Draw vertical line before each column (except first)
        if (cellIndex > 0) {
          doc.moveTo(currentX, y).lineTo(currentX, y + rowHeight).stroke();
        }
        
        // Determine alignment - right for currency, center for others
        const align = (cellIndex >= 1 && cellIndex <= 5) ? 'right' : 'center';
        const padding = align === 'right' ? 8 : 3;
        
        doc.text(cellData, currentX + padding, y + 8, { 
          width: columnWidths[cellIndex] - (padding * 2), 
          align: align,
          ellipsis: true
        });
        
        currentX += columnWidths[cellIndex];
      });

      // Draw final vertical line for row
      doc.moveTo(currentX, y).lineTo(currentX, y + rowHeight).stroke();
    });

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    error.statusCode = 500;
    next(error);
  }
};

// Excel Report Generator
const generateExcelReport = async (req, res, next) => {
  try {
    const { startDate, endDate, range } = req.query;

    // Mock res.json to reuse getSalesData logic (fetch all orders, no pagination)
    let data;
    await getSalesData(
      { query: { startDate, endDate, range, page: 1, limit: Infinity } },
      {
        json: (result) => {
          data = result;
        },
      }
    );

    // Recalculate summary
    const allOrders = data.orders || [];
    const totalOrdersCount = allOrders.length;
    const sales = allOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
    const discounts = allOrders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const couponsRedeemed = allOrders.reduce((sum, order) => sum + (order.coupon || 0), 0);
    
    const summary = {
      cancelledOrRefunded: 0,
      couponsRedeemed,
      discounts,
      grossSales: sales + discounts + couponsRedeemed,
      netSales: (sales + discounts + couponsRedeemed) - (discounts + couponsRedeemed),
      totalOrders: totalOrdersCount
    };

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Set column widths
    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Discount', key: 'discount', width: 15 },
      { header: 'Coupon', key: 'coupon', width: 15 },
      { header: 'Final Amount', key: 'finalAmount', width: 15 },
      { header: 'Return/Cancelled', key: 'returnOrCancelled', width: 18 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    // Add title
    worksheet.mergeCells('A1:I1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'HOURLY Sales Report';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    // Add date range
    worksheet.mergeCells('A2:I2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Date Range: ${startDate && endDate ? startDate + ' to ' + endDate : 'All Data'}`;
    dateCell.alignment = { horizontal: 'center' };

    // Add summary section
    worksheet.addRow([]);
    worksheet.addRow(['Summary']);
    worksheet.getCell('A4').font = { bold: true };
    
    worksheet.addRow(['Gross Sales:', `Rs. ${(summary.grossSales || 0).toLocaleString('en-IN')}`]);
    worksheet.addRow(['Cancelled/Refunded:', `Rs. ${(summary.cancelledOrRefunded || 0).toLocaleString('en-IN')}`]);
    worksheet.addRow(['Coupons Redeemed:', `Rs. ${(summary.couponsRedeemed || 0).toLocaleString('en-IN')}`]);
    worksheet.addRow(['Discounts:', `Rs. ${(summary.discounts || 0).toLocaleString('en-IN')}`]);
    worksheet.addRow(['Net Sales:', `Rs. ${(summary.netSales || 0).toLocaleString('en-IN')}`]);
    worksheet.addRow(['Total Orders:', `${(summary.totalOrders || 0).toLocaleString('en-IN')}`]);

    // Add empty row before table
    worksheet.addRow([]);

    // Add table headers
    const headerRow = worksheet.addRow([
      'Order ID', 'Amount', 'Discount', 'Coupon', 'Final Amount', 
      'Return/Cancelled', 'Payment Method', 'Date', 'Status'
    ]);
    
    // Style header row
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add data rows
    allOrders.forEach(order => {
      const row = worksheet.addRow([
        order.orderId || 'N/A',
        `Rs.${(order.amount + order.discount +  order.coupon|| 0).toLocaleString('en-IN')}`,
        `Rs.${(order.discount || 0).toLocaleString('en-IN')}`,
        `Rs.${(order.coupon || 0).toLocaleString('en-IN')}`,
        `Rs.${(order.finalAmount || 0).toLocaleString('en-IN')}`,
        `Rs.${(order.returnOrCancelled || 0).toLocaleString('en-IN')}`,
        order.paymentMethod || 'N/A',
        order.date || 'N/A',
        order.status || 'N/A'
      ]);

      // Add borders to data rows
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales_report_${moment().format('YYYYMMDD')}.xlsx`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating Excel:', error);
    error.statusCode = 500;
    next(error);
  }
};

module.exports = {
  getSalesReport,
  getSalesData,
  generatePDFReport,
  generateExcelReport
};