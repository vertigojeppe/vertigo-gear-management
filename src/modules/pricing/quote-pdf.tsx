import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/format";
import { appConfig } from "../../../config/app.config";
import type { Quote } from "./queries";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  h1: { fontSize: 18, marginBottom: 4 },
  muted: { color: "#666" },
  bold: { fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", paddingVertical: 4 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111", paddingVertical: 4, fontFamily: "Helvetica-Bold" },
  c1: { flex: 4 },
  c2: { flex: 0.8, textAlign: "right" },
  c3: { flex: 1.4, textAlign: "right" },
  c4: { flex: 1, textAlign: "right" },
  c5: { flex: 1.5, textAlign: "right" },
  section: { marginTop: 16 },
  totals: { marginTop: 8, alignItems: "flex-end" },
  sig: { marginTop: 40, flexDirection: "row", justifyContent: "space-between" },
  sigBox: { width: "45%", borderTopWidth: 1, borderTopColor: "#111", paddingTop: 4 },
});

export type QuotePdfKind = "quote" | "agreement";

/**
 * Quote (project) or rental agreement (rental): parties, period and
 * charge days, gear lines priced through the rate table, extra lines,
 * discounts, totals excl. and incl. VAT, terms; the agreement adds
 * signature boxes.
 */
export async function renderQuote(q: Quote, opts: { kind: QuotePdfKind; title: string; terms: string; labels: { day: string; days: string } }): Promise<Buffer> {
  const { totals } = q;
  const dayWord = (n: number) => (n === 1 ? opts.labels.day : opts.labels.days);
  const doc = (
    <Document title={`${opts.title} – ${q.holder.title}`} author={appConfig.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{opts.title}</Text>
        <Text style={styles.muted}>
          {appConfig.name} · {formatDate(new Date())} · {q.holder.reference}
        </Text>

        <View style={styles.section}>
          <Text style={styles.bold}>{q.holder.kind === "rental" ? "Renter" : "Client"}</Text>
          {q.client ? (
            <>
              <Text>{q.client.name}</Text>
              {q.client.contactName && <Text>{q.client.contactName}</Text>}
              {q.client.address && <Text>{q.client.address}</Text>}
              {(q.client.email || q.client.phone) && <Text>{[q.client.email, q.client.phone].filter(Boolean).join(" · ")}</Text>}
            </>
          ) : (
            <Text style={styles.muted}>—</Text>
          )}
          {q.holder.kind === "project" && <Text style={{ marginTop: 4 }}>Project: {q.holder.title}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>Period</Text>
          <Text>
            {q.window ? `${formatDate(q.window.from)} – ${formatDate(q.window.to)}` : "—"} · {q.chargeDays} {dayWord(q.chargeDays)} charged · rate table {q.rateTable?.name ?? "—"} (factor {totals.factor})
          </Text>
          {q.deposit !== null && <Text>Deposit: {formatMoney(q.deposit)}</Text>}
        </View>

        <View style={styles.section}>
          <View style={styles.head}>
            <Text style={styles.c1}>Equipment</Text>
            <Text style={styles.c2}>Qty</Text>
            <Text style={styles.c3}>Per day</Text>
            <Text style={styles.c4}>Disc.</Text>
            <Text style={styles.c5}>Line total</Text>
          </View>
          {q.gearLines.map((l) => (
            <View key={l.id} style={styles.row}>
              <Text style={styles.c1}>
                {l.label}
                {l.itemTag ? ` (${l.itemTag})` : ""}
                {l.note ? ` – ${l.note}` : ""}
              </Text>
              <Text style={styles.c2}>{l.quantity}</Text>
              <Text style={styles.c3}>{l.dayPrice !== null ? formatMoney(l.dayPrice) : "–"}</Text>
              <Text style={styles.c4}>{l.discountPct ? `${l.discountPct}%` : ""}</Text>
              <Text style={styles.c5}>{formatMoney(l.net)}</Text>
            </View>
          ))}
          {q.extraLines.map((l) => (
            <View key={l.id} style={styles.row}>
              <Text style={styles.c1}>{l.description}</Text>
              <Text style={styles.c2}>{l.quantity}</Text>
              <Text style={styles.c3}>{formatMoney(l.unitPrice)}</Text>
              <Text style={styles.c4}>{l.discountPct ? `${l.discountPct}%` : ""}</Text>
              <Text style={styles.c5}>{formatMoney(l.net)}</Text>
            </View>
          ))}
          <View style={styles.totals}>
            {totals.documentDiscount > 0 && (
              <>
                <Text>Lines: {formatMoney(totals.linesTotal)}</Text>
                <Text>
                  Discount {q.discountPct}%: −{formatMoney(totals.documentDiscount)}
                </Text>
              </>
            )}
            <Text>Subtotal excl. VAT: {formatMoney(totals.subtotal)}</Text>
            <Text>
              VAT {Math.round(q.vatRate * 100)}%: {formatMoney(totals.vat)}
            </Text>
            <Text style={styles.bold}>Total incl. VAT: {formatMoney(totals.total)}</Text>
          </View>
        </View>

        {q.notes && (
          <View style={styles.section}>
            <Text style={styles.bold}>Notes</Text>
            <Text>{q.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.muted}>{opts.terms}</Text>
        </View>

        {opts.kind === "agreement" && (
          <View style={styles.sig}>
            <View style={styles.sigBox}>
              <Text>{appConfig.name}</Text>
            </View>
            <View style={styles.sigBox}>
              <Text>{q.client?.name ?? ""}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
