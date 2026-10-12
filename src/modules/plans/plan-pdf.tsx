import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate, formatDateTime } from "@/lib/format";
import type { DateString } from "@/lib/dates";
import { appConfig } from "../../../config/app.config";
import type { PlanDetail } from "./queries";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: "#111" },
  h1: { fontSize: 16, marginBottom: 2 },
  h2: { marginTop: 14, fontSize: 11, fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderBottomColor: "#111", paddingBottom: 2 },
  muted: { color: "#666" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 3 },
  time: { width: 76 },
  who: { width: 90, color: "#444" },
  grow: { flex: 1 },
  box: { width: 10, height: 10, borderWidth: 1, borderColor: "#111", marginRight: 6, marginTop: 1 },
  boxDone: { width: 10, height: 10, borderWidth: 1, borderColor: "#111", backgroundColor: "#111", marginRight: 6, marginTop: 1 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#888", flexDirection: "row", justifyContent: "space-between" },
});

const PHASE_LABEL: Record<string, string> = { pre_production: "Pre-production", build: "Build", show: "Show", post: "Post" };
const KIND_LABEL: Record<string, string> = { vehicle: "Vehicle", parking: "Parking", loading: "Loading dock", hotel: "Hotel", travel: "Travel", other: "Other" };

/**
 * Day sheet (one day: that day's schedule, crew call times, logistics on
 * the day, open tasks due that day) or the full plan (every day plus
 * tasks, logistics, crew and contacts).
 */
export async function renderPlan(detail: PlanDetail, opts: { day?: DateString } = {}): Promise<Buffer> {
  const { project, days, tasks, logistics, crew, contacts, plan } = detail;
  const dayOnly = opts.day;
  const shownDays = dayOnly ? days.filter((d) => d.day === dayOnly) : days;
  const shownTasks = dayOnly ? tasks.filter((t) => t.dueDate === dayOnly && !t.done) : tasks;
  const shownLogistics = dayOnly ? logistics.filter((l) => !l.at || formatDate(l.at) === formatDate(dayOnly)) : logistics;
  const title = dayOnly ? `Day sheet ${formatDate(dayOnly)}` : "Production plan";
  const header = [project.clientName, project.venueName, project.venueAddress].filter(Boolean).join(" · ");

  const doc = (
    <Document title={`${project.name} – ${title}`} author={appConfig.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>
          {project.name} — {title}
        </Text>
        {header ? <Text style={styles.muted}>{header}</Text> : null}
        <Text style={styles.muted}>
          {[project.loadIn ? `Load-in ${formatDateTime(project.loadIn)}` : null, project.showStart ? `Show ${formatDateTime(project.showStart)}` : null, project.loadOut ? `Load-out ${formatDateTime(project.loadOut)}` : null].filter(Boolean).join(" · ")}
        </Text>

        {shownDays.length === 0 && dayOnly ? <Text style={{ marginTop: 12 }}>Nothing scheduled on this day.</Text> : null}
        {shownDays.map((d) => (
          <View key={d.day} wrap={false}>
            <Text style={styles.h2}>{formatDate(d.day)}</Text>
            {d.entries.map((e) => (
              <View key={e.id} style={styles.row}>
                <Text style={styles.time}>
                  {e.time}
                  {e.endTime ? `–${e.endTime}` : ""}
                </Text>
                <View style={styles.grow}>
                  <Text>
                    {e.title}
                    {e.location ? ` · ${e.location}` : ""}
                  </Text>
                  {e.notes ? <Text style={styles.muted}>{e.notes}</Text> : null}
                </View>
                <Text style={styles.who}>{e.responsibleName ?? ""}</Text>
              </View>
            ))}
          </View>
        ))}

        {crew.length > 0 && (
          <View wrap={false}>
            <Text style={styles.h2}>Crew</Text>
            {crew.map((c) => (
              <View key={c.id} style={styles.row}>
                <Text style={styles.grow}>
                  {c.name}
                  {c.role ? ` · ${c.role}` : ""}
                </Text>
                <Text style={styles.who}>{c.phone ?? ""}</Text>
                <Text style={styles.time}>{c.callTime ? (dayOnly ? formatDateTime(c.callTime).slice(-5) : formatDateTime(c.callTime)) : ""}</Text>
              </View>
            ))}
          </View>
        )}

        {!dayOnly && contacts.length > 0 && (
          <View wrap={false}>
            <Text style={styles.h2}>Contacts</Text>
            {contacts.map((c) => (
              <View key={c.id} style={styles.row}>
                <Text style={styles.grow}>
                  {c.name}
                  {c.role ? ` · ${c.role}` : ""}
                </Text>
                <Text style={styles.who}>{[c.phone, c.email].filter(Boolean).join(" ")}</Text>
              </View>
            ))}
          </View>
        )}

        {shownLogistics.length > 0 && (
          <View wrap={false}>
            <Text style={styles.h2}>Logistics</Text>
            {shownLogistics.map((l) => (
              <View key={l.id} style={styles.row}>
                <Text style={styles.time}>{KIND_LABEL[l.kind] ?? l.kind}</Text>
                <View style={styles.grow}>
                  <Text>
                    {l.title}
                    {l.at ? ` · ${formatDateTime(l.at)}` : ""}
                  </Text>
                  {l.details ? <Text style={styles.muted}>{l.details}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {shownTasks.length > 0 && (
          <View wrap={false}>
            <Text style={styles.h2}>{dayOnly ? "Open tasks due today" : "Tasks"}</Text>
            {shownTasks.map((t) => (
              <View key={t.id} style={styles.row}>
                <View style={t.done ? styles.boxDone : styles.box} />
                <View style={styles.grow}>
                  <Text>
                    {t.title}
                    {!dayOnly ? ` · ${PHASE_LABEL[t.phase] ?? t.phase}` : ""}
                  </Text>
                  {t.notes ? <Text style={styles.muted}>{t.notes}</Text> : null}
                </View>
                <Text style={styles.who}>{t.assigneeName ?? ""}</Text>
                <Text style={styles.time}>{t.dueDate ? formatDate(t.dueDate) : ""}</Text>
              </View>
            ))}
          </View>
        )}

        {!dayOnly && plan.notes ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.h2}>Notes</Text>
            <Text>{plan.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {appConfig.name} · {project.name} · printed {formatDate(new Date())}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
