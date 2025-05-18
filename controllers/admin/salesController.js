const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');

// Render sales report page with paginated data
const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, page = 1 } = req.query;
    const currentPage = parseInt(page);
    const limit = 5;
    const skip = (currentPage - 1) * limit;

    // Build the query for filtering orders by date range
    let dateFilter = {};
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
    // Either use the user field if it exists, or remove populate if it doesn't
    const orders = await Order.find(dateFilter)
      // Comment out or modify this line if user field doesn't exist in your schema yet
      //.populate('user', 'name') 
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate summary stats (based on all orders)
    const allOrders = await Order.find(dateFilter);
    const grossSales = allOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    const couponsRedeemed = allOrders.reduce((sum, order) => sum + (order.couponApplied ? order.discount : 0), 0);
    const discounts = allOrders.reduce((sum, order) => sum + order.discount, 0);
    const cancelledOrRefunded = allOrders.reduce(
      (sum, order) => sum + (['Canceled', 'Returned'].includes(order.status) ? order.finalAmount : 0),
      0
    );
    const netSales = grossSales - discounts;
    const totalOrders = totalOrdersCount;

    // Format orders for the table
    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      amount: order.totalPrice,
      discount: order.discount,
      coupon: order.couponApplied ? order.discount : 0,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      returnOrCancelled: ['Canceled', 'Returned'].includes(order.status) ? order.finalAmount : 0,
      revisedCoupon: 0, // Placeholder; adjust if you have logic
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
    console.error('Error fetching sales report:', error);
    res.status(500).send('Server Error');
  }
};

// Fetch sales data for Fetch API (dynamic updates)
const getSalesData = async (req, res) => {
  try {
    const { startDate, endDate, range } = req.query;
    let dateFilter = {};

    // Handle date range
    if (range === 'custom' && startDate && endDate) {
      const startDateObj = moment(startDate, 'DD-MM-YYYY').startOf('day').toDate();
      const endDateObj = moment(endDate, 'DD-MM-YYYY').endOf('day').toDate();
      dateFilter = {
        createdOn: {
          $gte: startDateObj,
          $lte: endDateObj,
        },
      };
    } else {
      const today = moment().startOf('day');
      switch (range) {
        case 'today':
          dateFilter = {
            createdOn: {
              $gte: today.toDate(),
              $lte: today.endOf('day').toDate(),
            },
          };
          break;
        case 'yesterday':
          dateFilter = {
            createdOn: {
              $gte: today.subtract(1, 'days').startOf('day').toDate(),
              $lte: today.endOf('day').toDate(),
            },
          };
          break;
        case 'last7days':
          dateFilter = {
            createdOn: {
              $gte: today.subtract(6, 'days').startOf('day').toDate(),
              $lte: moment().endOf('day').toDate(),
            },
          };
          break;
        case 'last30days':
          dateFilter = {
            createdOn: {
              $gte: today.subtract(29, 'days').startOf('day').toDate(),
              $lte: moment().endOf('day').toDate(),
            },
          };
          break;
        case 'thisMonth':
          dateFilter = {
            createdOn: {
              $gte: today.startOf('month').toDate(),
              $lte: today.endOf('month').toDate(),
            },
          };
          break;
        case 'lastMonth':
          dateFilter = {
            createdOn: {
              $gte: today.subtract(1, 'month').startOf('month').toDate(),
              $lte: today.subtract(1, 'month').endOf('month').toDate(),
            },
          };
          break;
        case 'thisYear':
          dateFilter = {
            createdOn: {
              $gte: today.startOf('year').toDate(),
              $lte: today.endOf('year').toDate(),
            },
          };
          break;
        default:
          dateFilter = {};
      }
    }

    // Fetch all orders for stats (no pagination for Fetch API)
    // Remove or modify the populate method if user field doesn't exist
    const allOrders = await Order.find(dateFilter)
      //.populate('user', 'name')
      .sort({ createdOn: -1 });

    // Calculate summary stats
    const summary = {
      grossSales: allOrders.reduce((sum, order) => sum + order.totalPrice, 0),
      cancelledOrRefunded: allOrders.reduce(
        (sum, order) => sum + (['Canceled', 'Returned'].includes(order.status) ? order.finalAmount : 0),
        0
      ),
      couponsRedeemed: allOrders.reduce((sum, order) => sum + (order.couponApplied ? order.discount : 0), 0),
      discounts: allOrders.reduce((sum, order) => sum + order.discount, 0),
      netSales: allOrders.reduce((sum, order) => sum + order.totalPrice, 0) -
                allOrders.reduce((sum, order) => sum + order.discount, 0),
      totalOrders: allOrders.length,
    };

    // Format orders for table
    const formattedOrders = allOrders.map((order) => ({
      orderId: order.orderId,
      amount: order.totalPrice,
      discount: order.discount,
      coupon: order.couponApplied ? order.discount : 0,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      returnOrCancelled: ['Canceled', 'Returned'].includes(order.status) ? order.finalAmount : 0,
      revisedCoupon: 0, // Placeholder
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
    });
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ success: false, message: 'Error fetching sales data' });
  }
};

// Generate PDF report
const generatePDFReport = async (req, res) => {
  try {
    const { startDate, endDate, range } = req.query;

    // Mock res.json to reuse getSalesData logic
    let data;
    await getSalesData(
      { query: { startDate, endDate, range } },
      {
        json: (result) => {
          data = result;
        },
      }
    );

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales_report_${moment().format('YYYYMMDD')}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('HOURLY Sales Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date Range: ${startDate || 'All'} to ${endDate || 'All'}`, { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(14).text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Gross Sales: ₹ ${data.summary.grossSales.toLocaleString()}`);
    doc.text(`Cancelled/Refunded: ₹ ${data.summary.cancelledOrRefunded.toLocaleString()}`);
    doc.text(`Coupons Redeemed: ₹ ${data.summary.couponsRedeemed.toLocaleString()}`);
    doc.text(`Discounts: ₹ ${data.summary.discounts.toLocaleString()}`);
    doc.text(`Net Sales: ₹ ${data.summary.netSales.toLocaleString()}`);
    doc.text(`Total Orders: ${data.summary.totalOrders}`);
    doc.moveDown();

    // Table
    doc.fontSize(14).text('Orders', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const tableHeaders = ['Order ID', 'Amount', 'Discount', 'Coupon', 'Final Amount', 'Return/Cancelled', 'Payment', 'Date', 'Status'];
    const columnWidths = [80, 60, 60, 60, 80, 80, 80, 80, 80];

    // Draw headers
    doc.fontSize(10).font('Helvetica-Bold');
    tableHeaders.forEach((header, i) => {
      doc.text(header, 50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop, { width: columnWidths[i], align: 'left' });
    });

    // Draw rows
    doc.font('Helvetica');
    data.orders.forEach((order, index) => {
      const y = tableTop + 20 + index * 20;
      doc.text(order.orderId, 50, y, { width: columnWidths[0], align: 'left' });
      doc.text(`₹ ${order.amount.toLocaleString()}`, 50 + columnWidths[0], y, { width: columnWidths[1], align: 'left' });
      doc.text(`₹ ${order.discount.toLocaleString()}`, 50 + columnWidths.slice(0, 2).reduce((a, b) => a + b, 0), y, { width: columnWidths[2], align: 'left' });
      doc.text(`₹ ${order.coupon.toLocaleString()}`, 50 + columnWidths.slice(0, 3).reduce((a, b) => a + b, 0), y, { width: columnWidths[3], align: 'left' });
      doc.text(`₹ ${order.finalAmount.toLocaleString()}`, 50 + columnWidths.slice(0, 4).reduce((a, b) => a + b, 0), y, { width: columnWidths[4], align: 'left' });
      doc.text(`₹ ${order.returnOrCancelled.toLocaleString()}`, 50 + columnWidths.slice(0, 5).reduce((a, b) => a + b, 0), y, { width: columnWidths[5], align: 'left' });
      doc.text(order.paymentMethod, 50 + columnWidths.slice(0, 6).reduce((a, b) => a + b, 0), y, { width: columnWidths[6], align: 'left' });
      doc.text(order.date, 50 + columnWidths.slice(0, 7).reduce((a, b) => a + b, 0), y, { width: columnWidths[7], align: 'left' });
      doc.text(order.status, 50 + columnWidths.slice(0, 8).reduce((a, b) => a + b, 0), y, { width: columnWidths[8], align: 'left' });
    });

    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).send('Error generating PDF report');
  }
};

// Generate Excel report
const generateExcelReport = async (req, res) => {
  try {
    const { startDate, endDate, range } = req.query;

    // Mock res.json to reuse getSalesData logic
    let data;
    await getSalesData(
      { query: { startDate, endDate, range } },
      {
        json: (result) => {
          data = result;
        },
      }
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Summary
    worksheet.addRow(['HOURLY Sales Report']);
    worksheet.addRow([`Date Range: ${startDate || 'All'} to ${endDate || 'All'}`]);
    worksheet.addRow([]);
    worksheet.addRow(['Summary']);
    worksheet.addRow(['Gross Sales', `₹ ${data.summary.grossSales.toLocaleString()}`]);
    worksheet.addRow(['Cancelled/Refunded', `₹ ${data.summary.cancelledOrRefunded.toLocaleString()}`]);
    worksheet.addRow(['Coupons Redeemed', `₹ ${data.summary.couponsRedeemed.toLocaleString()}`]);
    worksheet.addRow(['Discounts', `₹ ${data.summary.discounts.toLocaleString()}`]);
    worksheet.addRow(['Net Sales', `₹ ${data.summary.netSales.toLocaleString()}`]);
    worksheet.addRow(['Total Orders', data.summary.totalOrders]);
    worksheet.addRow([]);

    // Table
    worksheet.addRow(['Orders']);
    worksheet.addRow(['Order ID', 'Amount', 'Discount', 'Coupon', 'Final Amount', 'Return/Cancelled', 'Payment Method', 'Date', 'Status']);

    // Add order data
    data.orders.forEach((order) => {
      worksheet.addRow([
        order.orderId,
        `₹ ${order.amount.toLocaleString()}`,
        `₹ ${order.discount.toLocaleString()}`,
        `₹ ${order.coupon.toLocaleString()}`,
        `₹ ${order.finalAmount.toLocaleString()}`,
        `₹ ${order.returnOrCancelled.toLocaleString()}`,
        order.paymentMethod,
        order.date,
        order.status,
      ]);
    });

    // Styling
    worksheet.getRow(1).font = { size: 16, bold: true };
    worksheet.getRow(4).font = { size: 14, bold: true };
    worksheet.getRow(12).font = { size: 14, bold: true };
    worksheet.getRow(13).font = { bold: true };
    worksheet.getRow(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

    // Set column widths
    worksheet.columns = [
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales_report_${moment().format('YYYYMMDD')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel report:', error);
    res.status(500).send('Error generating Excel report');
  }
};

module.exports = {
    getSalesReport,
    getSalesData,
    generatePDFReport,
    generateExcelReport
};