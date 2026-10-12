import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate } from "@/lib/format";
import { appConfig } from "../../../config/app.config";
import { groupLines, type ListDetail } from "./queries";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: "#111" },
  h1: { fontSize: 16, marginBottom: 2 },
  muted: { color: "#666" },
  group: { marginTop: 12, fontSize: 11, fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderBottomColor: "#111", paddingBottom: 2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 3 },
  box: { width: 12, height: 12, borderWidth: 1, borderColor: "#111", marginRight: 6, marginTop: 1 },
  qty: { width: 36, textAlign: "right", paddingRight: 8 },
  name: { flex: 1 },
  tags: { width: 150, color: "#444" },
  weight: { width: 50, textAlign: "right" },
  totals: { marginTop: 14, flexDirection: "row", gap: 16 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#888", flexDirection: "row", justifyContent: "space-between" },
});

/** Printable packing list: one checkbox row per line, grouped like the screen. */
export async function renderPackingList(detail: ListDetail): Promise<Buffer> {
  const { list, project, lines, totals, progress } = detail;
  const groups = groupLines(lines, list.groupBy);
  const doc = (
    <Document title={`${project.name} – ${list.name}`} author={appConfig.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{list.name}</Text>
        <Text style={styles.muted}>
          {project.name}
          {project.clientName ? ` · ${project.clientName}` : ""}
          {project.venueName ? ` · ${project.venueName}` : ""}
          {project.reserveFrom ? ` · ${formatDate(project.reserveFrom)} – ${formatDate(project.reserveTo ?? project.reserveFrom)}` : ""}
        </Text>
        <Text style={styles.muted}>
          {progress.units} units · {totals.cases} cases · {totals.weightKg} kg{totals.unknownWeight ? ` (+${totals.unknownWeight} without weight)` : ""} · {totals.powerW} W · printed {formatDate(new Date())}
        </Text>
        {groups.map((g) => (
          <View key={g.key} wrap={false}>
            <Text style={styles.group}>{g.label}</Text>
            {g.lines.map((l) => (
              <View key={l.id} style={styles.row}>
                <View style={styles.box} />
                <Text style={styles.qty}>{l.quantity}×</Text>
                <View style={styles.name}>
                  <Text>
                    {l.modelLabel}
                    {l.itemName ? ` – ${l.itemName}` : ""}
                    {l.note && l.note !== l.itemName ? ` (${l.note})` : ""}
                  </Text>
                  {l.isKit && l.kitContents.length > 0 && <Text style={styles.muted}>contains: {l.kitContents.map((c) => `${c.quantity > 1 ? `${c.quantity}× ` : ""}${c.label}`).join(", ")}</Text>}
                </View>
                <Text style={styles.tags}>{l.checks.filter((c) => c.phase === "out" && c.assetTag).map((c) => c.assetTag).join(", ") || (l.itemTag ?? "")}</Text>
                <Text style={styles.weight}>{l.weightKg !== null ? `${Math.round(l.weightKg * l.quantity * 10) / 10} kg` : ""}</Text>
              </View>
            ))}
          </View>
        ))}
        {list.notes && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Notes</Text>
            <Text>{list.notes}</Text>
          </View>
        )}
        <View style={styles.footer} fixed>
          <Text>{appConfig.name}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
