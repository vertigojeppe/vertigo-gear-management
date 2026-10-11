import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/format";
import { appConfig } from "../../../config/app.config";
import type { rentalDetail } from "./queries";

type Detail = NonNullable<Awaited<ReturnType<typeof rentalDetail>>>;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  h1: { fontSize: 18, marginBottom: 4 },
  muted: { color: "#666" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", paddingVertical: 4 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111", paddingVertical: 4, fontFamily: "Helvetica-Bold" },
  c1: { flex: 4 },
  c2: { flex: 1, textAlign: "right" },
  c3: { flex: 1.5, textAlign: "right" },
  c4: { flex: 1.5, textAlign: "right" },
  section: { marginTop: 16 },
  totals: { marginTop: 8, alignItems: "flex-end" },
  sig: { marginTop: 40, flexDirection: "row", justifyContent: "space-between" },
  sigBox: { width: "45%", borderTopWidth: 1, borderTopColor: "#111", paddingTop: 4 },
});

/** Simple rental agreement: parties, period, lines, totals, signatures. */
export async function renderAgreement(detail: Detail): Promise<Buffer> {
  const { rental, client, lines, totals } = detail;
  const doc = (
    <Document title={`Rental agreement – ${client.name}`} author={appConfig.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Rental agreement</Text>
        <Text style={styles.muted}>
          {appConfig.name} · {formatDate(new Date())} · Ref {rental.id.slice(-8).toUpperCase()}
        </Text>

        <View style={styles.section}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Renter</Text>
          <Text>{client.name}</Text>
          {client.contactName && <Text>{client.contactName}</Text>}
          {client.address && <Text>{client.address}</Text>}
          {(client.email || client.phone) && <Text>{[client.email, client.phone].filter(Boolean).join(" · ")}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Period</Text>
          <Text>
            {formatDate(rental.startDate)} – {formatDate(rental.endDate)} ({totals.days} {totals.days === 1 ? "day" : "days"})
          </Text>
          {rental.deposit !== null && <Text>Deposit: {formatMoney(rental.deposit)}</Text>}
        </View>

        <View style={styles.section}>
          <View style={styles.head}>
            <Text style={styles.c1}>Equipment</Text>
            <Text style={styles.c2}>Qty</Text>
            <Text style={styles.c3}>Per day / week</Text>
            <Text style={styles.c4}>Line total</Text>
          </View>
          {lines.map((l) => (
            <View key={l.id} style={styles.row}>
              <Text style={styles.c1}>
                {l.modelLabel}
                {l.itemTag ? ` (${l.itemTag})` : ""}
                {l.note ? ` – ${l.note}` : ""}
              </Text>
              <Text style={styles.c2}>{l.quantity}</Text>
              <Text style={styles.c3}>{[l.pricePerDay !== null ? formatMoney(l.pricePerDay) : null, l.pricePerWeek !== null ? formatMoney(l.pricePerWeek) : null].filter(Boolean).join(" / ") || "–"}</Text>
              <Text style={styles.c4}>{formatMoney(l.lineTotal)}</Text>
            </View>
          ))}
          <View style={styles.totals}>
            <Text>Subtotal: {formatMoney(totals.subtotal)}</Text>
            <Text>
              VAT {Math.round(appConfig.vatRate * 100)}%: {formatMoney(totals.vat)}
            </Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Total: {formatMoney(totals.total)}</Text>
          </View>
        </View>

        {rental.notes && (
          <View style={styles.section}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Notes</Text>
            <Text>{rental.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.muted}>
            The renter is responsible for the equipment from hand-over until return and for any loss or damage at replacement value. Equipment is returned clean and complete, in the same cases, at the agreed date.
          </Text>
        </View>

        <View style={styles.sig}>
          <View style={styles.sigBox}>
            <Text>{appConfig.name}</Text>
          </View>
          <View style={styles.sigBox}>
            <Text>{client.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
