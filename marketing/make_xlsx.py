
import zipfile
from xml.sax.saxutils import escape

# build minimal xlsx by hand (openpyxl may not be installed)
shared = ["اسم الصنف","المجموعة","السعر","كمية"]
rows = [
    ("شاي العروسة", "مشروبات", 15, 100),
    ("سكر 1كيلو", "بقالة", 30, 50),
]
# sheet1
cells = []
for r_i, row in enumerate(rows, start=2):
    cells.append(f'<row r="{r_i}"><c r="A{r_i}" t="s"><v>0</v></c><c r="B{r_i}" t="s"><v>1</v></c><c r="C{r_i}"><v>{row[2]}</v></c><c r="D{r_i}"><v>{row[3]}</v></c></row>')
sheet = f'<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>' + "".join(cells) + '</sheetData></worksheet>'
ss = '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">' + "".join(f'<si><t>{escape(s)}</t></si>' for s in shared) + '</sst>'
ct = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
root = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
wb = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
wbrels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
with zipfile.ZipFile('C:/Users/LOGO/Desktop/octopus/marketing/test_items.xlsx','w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', ct)
    z.writestr('_rels/.rels', root)
    z.writestr('xl/workbook.xml', wb)
    z.writestr('xl/_rels/workbook.xml.rels', wbrels)
    z.writestr('xl/sharedStrings.xml', ss)
    z.writestr('xl/worksheets/sheet1.xml', sheet)
print("xlsx written")
