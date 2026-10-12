import { Document, Image, Line, Page, Path, Polygon, Rect, StyleSheet, Svg, Text, Text as SvgText, View, renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import type { DateString } from "@/lib/dates";
import { rasterizePdfPage } from "@/lib/pdf-raster";
import { getStorage } from "@/lib/storage";
import { appConfig } from "../../../config/app.config";
import { documentsForPlan, type DocumentRow, type Shape } from "./documents";
import type { PlanDetail } from "./queries";

/** A document page ready for the PDF: PNG bytes, aspect ratio and its markup. */
type RenderedDoc = { name: string; page: number; pages: number; png: Buffer; width: number; height: number; shapes: Shape[]; pinnedTo: string | null };

const DOC_MAX_PX = 1400;

/**
 * Images and PDF pages with their markup layers. PDFs need poppler
 * (pdftoppm) on the server; without it they are listed, not drawn.
 */
async function renderDocuments(docs: DocumentRow[]): Promise<{ rendered: RenderedDoc[]; skippedPdf: string[] }> {
  const storage = getStorage();
  const rendered: RenderedDoc[] = [];
  const skippedPdf: string[] = [];
  for (const d of docs) {
    if (d.kind !== "image" && d.kind !== "pdf") continue;
    const file = await prisma.file.findUnique({ where: { id: d.latest.fileId } });
    if (!file) continue;
    let bytes: Buffer;
    try {
      bytes = await storage.get(file.storageKey);
    } catch {
      continue;
    }
    const markupFor = (page: number) => d.latest.markups.find((m) => m.page === page)?.shapes ?? [];
    if (d.kind === "image") {
      try {
        const img = sharp(bytes).rotate().resize({ width: DOC_MAX_PX, height: DOC_MAX_PX, fit: "inside", withoutEnlargement: true }).png();
        const { data, info } = await img.toBuffer({ resolveWithObject: true });
        rendered.push({ name: d.name, page: 1, pages: 1, png: data, width: info.width, height: info.height, shapes: markupFor(1), pinnedTo: d.pinnedTo });
      } catch {
        /* unreadable image: skip */
      }
      continue;
    }
    // PDF: pages that have markup, else page 1.
    const pages = d.latest.markups.filter((m) => m.shapes.length > 0).map((m) => m.page);
    const wanted = pages.length > 0 ? pages : [1];
    let any = false;
    for (const page of wanted) {
      const png = await rasterizePdfPage(bytes, page, 96);
      if (!png) break;
      const info = await sharp(png).metadata();
      rendered.push({ name: d.name, page, pages: wanted.length, png, width: info.width ?? 1, height: info.height ?? 1, shapes: markupFor(page), pinnedTo: d.pinnedTo });
      any = true;
    }
    if (!any) skippedPdf.push(d.name);
  }
  return { rendered, skippedPdf };
}

/** Markup shapes scaled onto a w×h box. */
function MarkupSvg({ shapes, w, h }: { shapes: Shape[]; w: number; h: number }) {
  if (shapes.length === 0) return null;
  const X = (v: number) => v * w;
  const Y = (v: number) => v * h;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
      {shapes.map((s) => {
        if (s.type === "path") {
          const d = s.points.map((v, i) => `${i % 2 === 0 ? (i === 0 ? "M" : "L") : ""}${i % 2 === 0 ? X(v) : Y(v)}`).join(" ");
          return <Path key={s.id} d={d} stroke={s.color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
        }
        if (s.type === "rect") {
          return <Rect key={s.id} x={X(Math.min(s.points[0], s.points[2]))} y={Y(Math.min(s.points[1], s.points[3]))} width={X(Math.abs(s.points[2] - s.points[0]))} height={Y(Math.abs(s.points[3] - s.points[1]))} stroke={s.color} strokeWidth={2} fill="none" />;
        }
        if (s.type === "arrow") {
          const x1 = X(s.points[0]);
          const y1 = Y(s.points[1]);
          const x2 = X(s.points[2]);
          const y2 = Y(s.points[3]);
          const a = Math.atan2(y2 - y1, x2 - x1);
          const len = 8;
          const p1 = `${x2 - len * Math.cos(a - Math.PI / 6)},${y2 - len * Math.sin(a - Math.PI / 6)}`;
          const p2 = `${x2 - len * Math.cos(a + Math.PI / 6)},${y2 - len * Math.sin(a + Math.PI / 6)}`;
          return (
            <Svg key={s.id}>
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={s.color} strokeWidth={2} />
              <Polygon points={`${x2},${y2} ${p1} ${p2}`} fill={s.color} />
            </Svg>
          );
        }
        return (
          <SvgText key={s.id} x={X(s.points[0])} y={Y(s.points[1])} fill={s.color} style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>
            {s.text ?? ""}
          </SvgText>
        );
      })}
    </Svg>
  );
}

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
  // Documents: every image/PDF for the full plan; for a day sheet only those pinned to that day's entries.
  const allDocs = await documentsForPlan(plan.id);
  const dayEntryIds = new Set(shownDays.flatMap((d) => d.entries.map((e) => e.id)));
  const shownDocs = dayOnly ? allDocs.filter((d) => d.scheduleEntryId && dayEntryIds.has(d.scheduleEntryId)) : allDocs;
  const { rendered, skippedPdf } = await renderDocuments(shownDocs);
  const otherDocs = shownDocs.filter((d) => d.kind !== "image" && d.kind !== "pdf");
  const pageW = 595.28 - 72; // A4 minus padding
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

        {(shownDocs.length > 0 || skippedPdf.length > 0) && (
          <View>
            <Text style={styles.h2}>Documents</Text>
            {otherDocs.map((d) => (
              <View key={d.id} style={styles.row}>
                <Text style={styles.grow}>
                  {d.name} · {d.kind === "model3d" ? "3D model" : "file"} · v{d.latest.version}
                  {d.pinnedTo ? ` · ${d.pinnedTo}` : ""}
                </Text>
              </View>
            ))}
            {skippedPdf.map((n) => (
              <View key={n} style={styles.row}>
                <Text style={styles.grow}>{n} · PDF (needs poppler on the server to be drawn here)</Text>
              </View>
            ))}
          </View>
        )}
        {rendered.map((r) => {
          const scale = Math.min(pageW / r.width, 640 / r.height);
          const w = r.width * scale;
          const h = r.height * scale;
          return (
            <View key={`${r.name}-${r.page}`} wrap={false} style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>
                {r.name}
                {r.pages > 1 || r.page > 1 ? ` · page ${r.page}` : ""}
                {r.pinnedTo ? ` · ${r.pinnedTo}` : ""}
                {r.shapes.length > 0 ? ` · markup by ${[...new Set(r.shapes.map((s) => s.authorName).filter(Boolean))].join(", ")}` : ""}
              </Text>
              <View style={{ position: "relative", width: w, height: h }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                <Image src={{ data: r.png, format: "png" }} style={{ width: w, height: h }} />
                <MarkupSvg shapes={r.shapes} w={w} h={h} />
              </View>
            </View>
          );
        })}

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
