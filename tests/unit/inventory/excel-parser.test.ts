import ExcelJS from "exceljs";
import { parseProductExcel } from "../../../services/inventory-service/src/excel/parser";

async function buildExcelBuffer(rows: any[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");

  sheet.addRow([
    "name",
    "description",
    "price",
    "stock_quantity",
    "category_slug",
    "thumbnail_filename",
    "list_image_filename",
  ]);

  for (const row of rows) {
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe("parseProductExcel", () => {
  it("parses a valid row correctly", async () => {
    const buffer = await buildExcelBuffer([
      [
        "T-Shirt",
        "A plain tee",
        "19.99",
        10,
        "shirts",
        "thumb.jpg",
        "list.jpg",
      ],
    ]);

    const { validRows, errors } = await parseProductExcel(buffer);

    expect(errors).toHaveLength(0);
    expect(validRows).toHaveLength(1);
    expect(validRows[0]).toMatchObject({
      name: "T-Shirt",
      description: "A plain tee",
      price: "19.99",
      stock_quantity: 10,
      category_slug: "shirts",
      thumbnail_filename: "thumb.jpg",
      list_image_filename: "list.jpg",
    });
  });

  it("accepts row with no images — null filenames", async () => {
    const buffer = await buildExcelBuffer([
      ["Socks", "Cotton socks", "5.99", 50, "socks", "", ""],
    ]);

    const { validRows, errors } = await parseProductExcel(buffer);

    expect(errors).toHaveLength(0);
    expect(validRows[0].thumbnail_filename).toBeNull();
    expect(validRows[0].list_image_filename).toBeNull();
  });

  it("rejects row with missing name", async () => {
    const buffer = await buildExcelBuffer([
      ["", "desc", "9.99", 5, "shirts", "", ""],
    ]);

    const { validRows, errors } = await parseProductExcel(buffer);

    expect(validRows).toHaveLength(0);
    expect(errors[0]).toMatchObject({ row: 2, message: "name is required" });
  });

  it("rejects row with invalid price", async () => {
    const buffer = await buildExcelBuffer([
      ["Shirt", "desc", "notanumber", 5, "shirts", "", ""],
    ]);

    const { validRows, errors } = await parseProductExcel(buffer);

    expect(validRows).toHaveLength(0);
    expect(errors[0].message).toMatch(/price/);
  });

  it("rejects row with negative price", async () => {
    const buffer = await buildExcelBuffer([
      ["Shirt", "desc", "-5.00", 5, "shirts", "", ""],
    ]);

    const { validRows, errors } = await parseProductExcel(buffer);

    expect(errors[0].message).toMatch(/price/);
  });

  it("rejects row with negative stock", async () => {
    const buffer = await buildExcelBuffer([
      ["Shirt", "desc", "9.99", -1, "shirts", "", ""],
    ]);

    const { validRows, errors } = await parseProductExcel(buffer);

    expect(errors[0].message).toMatch(/stock_quantity/);
  });

  it("rejects row with missing category_slug", async () => {
    const buffer = await buildExcelBuffer([
      ["Shirt", "desc", "9.99", 5, "", "", ""],
    ]);

    const { validRows, errors } = await parseProductExcel(buffer);

    expect(errors[0].message).toMatch(/category_slug/);
  });

  it("processes valid rows and collects errors independently", async () => {
    const buffer = await buildExcelBuffer([
      ["Valid Product", "desc", "9.99", 5, "shirts", "", ""],
      ["", "desc", "9.99", 5, "shirts", "", ""],
      ["Another Valid", "desc", "4.99", 2, "socks", "", ""],
    ]);

    const { validRows, errors } = await parseProductExcel(buffer);

    expect(validRows).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(3);
  });

  it("returns error for empty workbook", async () => {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const { validRows, errors } = await parseProductExcel(buffer);

    expect(validRows).toHaveLength(0);
    expect(errors[0].message).toMatch(/no worksheets/);
  });
});
