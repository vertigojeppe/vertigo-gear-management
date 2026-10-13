import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { appConfig } from "../../../config/app.config";
import { cellFor, mm, pageCount, pageMm, type LabelSize } from "./label-layout";

export type LabelItem = { id: string; assetTag: string; url: string; title: string; subtitle: string | null };

/**
 * Asset-tag labels: a QR code (the item's URL), the tag in large type,
 * the model name and, for named units and kits, the name. Sheet sizes
 * lay the labels out on their grid with absolute positions; single sizes
 * put one label per page so a thermal printer gets one page per label.
 */
export async function renderLabels(items: LabelItem[], size: LabelSize, offset = 0): Promise<Buffer> {
  const page = pageMm(size);
  const pages = pageCount(size, items.length, offset);
  const qrs = await Promise.all(items.map((i) => QRCode.toDataURL(i.url, { margin: 0, errorCorrectionLevel: "M", scale: 6 })));
  const label = StyleSheet.create({
    cell: { position: "absolute", width: mm(size.widthMm), height: mm(size.heightMm), flexDirection: "row", padding: mm(2) },
    qr: { width: mm(size.heightMm - 4), height: mm(size.heightMm - 4) },
    text: { flex: 1, paddingLeft: mm(2), justifyContent: "center" },
    tag: { fontFamily: "Helvetica-Bold", fontSize: size.heightMm >= 35 ? 16 : 13 },
    title: { fontSize: size.heightMm >= 35 ? 8 : 7, marginTop: 2 },
    sub: { fontSize: 6.5, color: "#555", marginTop: 1 },
    brand: { fontSize: 5.5, color: "#888", marginTop: 2 },
  });
  const byPage: { item: LabelItem; qr: string; n: number }[][] = Array.from({ length: pages }, () => []);
  items.forEach((item, n) => byPage[cellFor(size, n, offset).page].push({ item, qr: qrs[n], n }));
  const doc = (
    <Document title={`Labels (${items.length})`} author={appConfig.name}>
      {byPage.map((entries, p) => (
        <Page key={p} size={[mm(page.w), mm(page.h)]} style={{ fontFamily: "Helvetica" }}>
          {entries.map(({ item, qr, n }) => {
            const cell = cellFor(size, n, offset);
            return (
              <View key={item.id} style={[label.cell, { left: mm(cell.xMm), top: mm(cell.yMm) }]} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                <Image src={qr} style={label.qr} />
                <View style={label.text}>
                  <Text style={label.tag}>{item.assetTag}</Text>
                  <Text style={label.title}>{trim(item.title, size.widthMm >= 60 ? 34 : 24)}</Text>
                  {item.subtitle && <Text style={label.sub}>{trim(item.subtitle, 34)}</Text>}
                  <Text style={label.brand}>{appConfig.name}</Text>
                </View>
              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}

function trim(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
