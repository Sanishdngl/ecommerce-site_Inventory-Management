import ExcelJS from "exceljs";
import { ParsedProductRow, RowError, ParseResult } from "@shared/types"

export async function parseProductExcel(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;

  await workbook.xlsx.load(arrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      validRows: [],
      errors: [{ row: 0, message: "Excel file contains no worksheets" }],
    };
  }

  const validRows: ParsedProductRow[] = [];
  const errors: RowError[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const name = String(row.getCell(1).value ?? "").trim();
    const description = String(row.getCell(2).value ?? "").trim();
    const priceRaw = String(row.getCell(3).value ?? "").trim();
    const stockRaw = row.getCell(4).value;
    const category_slug = String(row.getCell(5).value ?? "").trim();
    const thumbnail_filename =
      String(row.getCell(6).value ?? "").trim() || null;
    const list_image_filename =
      String(row.getCell(7).value ?? "").trim() || null;

    if (!name) {
      errors.push({ row: rowNumber, message: "name is required" });
      return;
    }

    const parsedPrice = parseFloat(priceRaw);
    if (!priceRaw || isNaN(parsedPrice) || parsedPrice <= 0) {
      errors.push({
        row: rowNumber,
        message: "price must be a positive number",
      });
      return;
    }

    if (stockRaw === null || stockRaw === undefined || stockRaw === "") {
      errors.push({ row: rowNumber, message: "stock_quantity is required" });
      return;
    }

    const stock_quantity = Number(stockRaw);
    if (!Number.isInteger(stock_quantity) || stock_quantity < 0) {
      errors.push({
        row: rowNumber,
        message: "stock_quantity must be a non-negative integer",
      });
      return;
    }

    if (!category_slug) {
      errors.push({ row: rowNumber, message: "category_slug is required" });
      return;
    }

    validRows.push({
      rowNumber,
      name,
      description,
      price: parsedPrice.toFixed(2),
      stock_quantity,
      category_slug,
      thumbnail_filename,
      list_image_filename,
    });
  });

  return { validRows, errors };
}
