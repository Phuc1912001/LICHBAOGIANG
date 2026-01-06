"use client";

import { useState } from "react";
import mammoth from "mammoth";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import toast, { Toaster } from "react-hot-toast";
import { FileText, CalendarDays, Download, Angry } from "lucide-react";

/* ======================
   TYPE
====================== */
type Lesson = { stt: string; name: string };
type LienByMon = Record<string, Lesson[]>;

/* ======================
   TKB CÔ ÁNH – CỐ ĐỊNH
====================== */
const scheduleAnh: Record<string, string[]> = {
  Hai_Sang: ["HĐTN", "Tiếng Việt", "TC Tiếng Việt", "Tiếng Việt"],
  Hai_Chieu: ["TN&XH", "Toán", "Tiếng Việt"],
  Ba_Sang: ["Tiếng Việt", "Toán", "Tiếng Việt", "Tiếng Việt"],
  Ba_Chieu: ["Âm nhạc", "HDH", "GDTC"],
  Tu_Sang: ["Mĩ thuật", "HĐTN", "TN&XH", "Đạo đức"],
  Tu_Chieu: ["Toán", "Tiếng Việt"],
  Nam_Sang: ["Tiếng Việt", "Tiếng Việt", "Toán", "Tin học"],
  Nam_Chieu: ["Tiếng Việt", "HDH", "HĐTT"],
  Sau_Sang: ["TC Mĩ thuật", "TC Toán", "TC Tiếng Việt", "GDTC"],
  Sau_Chieu: ["Toán", "HĐTN"],
};

/* ======================
   NORMALIZE MÔN CHO TEMPLATE
====================== */
const normalizeMon = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace("HDTN", "HĐTN")
    .replace("Tiếng Việt", "TV")
    .replace("TC Tiếng Việt", "TCTV")
    .replace("TC TV", "TCTV")
    .replace("TC Toán", "TCToan")
    .replace("TC-Toán", "TCToan")
    .replace("TC Mĩ thuật", "TCMT")
    .replace("Toán", "Toan")
    .replace("HD học", "HDH")
    .replace("HD Học", "HDH")
    .replace("HĐTT", "HĐTT")
    .replace("HDTT", "HĐTT")
    .replace("Tin học", "TH")
    .replace("Tin Học", "TH")
    .replace("Đạo Đức", "DD")
    .replace("Đạo đức", "DD")
    .replace("Mĩ thuật", "MT")
    .replace("Mĩ Thuật", "MT")
    .replace("Âm nhạc", "AN")
    .replace("Âm Nhạc", "AN")
    .trim();

/* ======================
   PARSE FILE CÔ LIÊN
====================== */
const parseLienWordByMon = async (file: File): Promise<{ byMon: LienByMon; html: string }> => {
  const buffer = await file.arrayBuffer();
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer });

  const dom = new DOMParser().parseFromString(value, "text/html");
  const rows = Array.from(dom.querySelectorAll("table tr"));
  const result: LienByMon = {};

  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll("td")).map(td => td.textContent?.trim() || "");
    if (cells.includes("Môn") || cells.length < 4) return;

    // Tìm cột môn trong row
    const monIndex = cells.findIndex(c =>
      Object.values(scheduleAnh).flat().some(m => normalizeMon(m) === normalizeMon(c))
    );

    if (monIndex === -1) return;

    const mon = cells[monIndex].trim();
    const stt = cells[monIndex - 1]?.trim() || "";
    const name = cells[monIndex + 1]?.trim() || "";

    if (!mon || !name) return;

    if (!result[mon]) result[mon] = [];
    result[mon].push({ stt, name });
  });

  console.log("Parsed byMon:", result);
  return { byMon: result, html: value };
};

/* ======================
   EXTRACT DATES, NGÀY
====================== */
const extractDaysWithDates = (html: string) => {
  const days: Record<string, string> = {};
  const dayNames = ["Hai", "Ba", "Tư", "Năm", "Sáu"];

  dayNames.forEach(day => {
    // Match tên thứ + bất kỳ ký tự nào (bao gồm xuống dòng) + ngày
    const regex = new RegExp(`${day}[\\s\\S]{0,50}?(\\d{1,2}/\\d{1,2})`, "i");
    const match = html.match(regex);
    days[`${day}_d`] = match ? match[1] : "";
  });

  return days;
};


const extractDatesAndDaysFromHtml = (html: string) => {
  const rangeMatch = html.match(/Từ ngày\s*(\d{1,2}\/\d{1,2})\s*đến\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const fromDate = rangeMatch ? rangeMatch[1] : "";
  const toDate = rangeMatch ? rangeMatch[2] : "";

  const signMatch = html.match(/Ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i);
  const sign_day = signMatch ? signMatch[1] : "";
  const sign_month = signMatch ? signMatch[2] : "";
  const sign_year = signMatch ? signMatch[3] : "";

  // const days: Record<string, string> = {};
  // ["Hai", "Ba", "Tư", "Năm", "Sáu"].forEach(day => {
  //   const dayMatch = html.match(new RegExp(`${day}\\s*<`, "i"));
  //   days[`${day}_d`] = dayMatch ? day : "";
  // });

  const days = extractDaysWithDates(html);

  return { fromDate, toDate, sign_day, sign_month, sign_year, days };
};

/* ======================
   COMPONENT
====================== */
export default function Home() {
  const [fileLien, setFileLien] = useState<File | null>(null);
  const [week, setWeek] = useState<number>();
  const [exporting, setExporting] = useState(false);

  const extractWeek = (name: string) => {
    const m = name.match(/tuan\s*(\d+)/i);
    return m ? Number(m[1]) : undefined;
  };

  const handleExport = async () => {
    if (!fileLien || !week) {
      toast.error("Thiếu file hoặc tuần!");
      return;
    }

    setExporting(true);

    try {
      const { byMon, html } = await parseLienWordByMon(fileLien);
      const { fromDate, toDate, sign_day, sign_month, sign_year, days } = extractDatesAndDaysFromHtml(html);

      // Map sang template format {TV_tenbai_1}, {Toán_stt_2}...
      const mappedData: Record<string, string> = {
        ...days,
        w: String(week),
        fromDate,
        toDate,
        sign_day,
        sign_month,
        sign_year,
      };
      console.log('byMon', byMon);


      Object.entries(byMon).forEach(([mon, lessons]) => {
        const keyMon = normalizeMon(mon);
        lessons.forEach((lesson, i) => {
          const idx = i + 1;
          mappedData[`${keyMon}_stt_${idx}`] = lesson.stt;
          mappedData[`${keyMon}_tenbai_${idx}`] = lesson.name;
        });
      });

      console.log("Mapped data for template:", mappedData);

      // Load template cô Ánh
      const res = await fetch("/template_anh.docx");
      const buf = await res.arrayBuffer();
      const zip = new PizZip(buf);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render(mappedData);

      const out = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      saveAs(out, `LBG_Anh_Tuan${week}.docx`);
      toast.success("Xuất LBG cô Ánh thành công 🎉");
    } catch (e) {
      console.error(e);
      toast.error("Lỗi xử lý file");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-white via-purple-100 to-white p-6">
      <Toaster />

      <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 space-y-4">
        <h1 className="text-3xl font-extrabold text-center text-purple-700 mb-4">
          LỊCH BÁO GIẢNG
        </h1>

        {/* File Input */}
        <label className="relative w-full block cursor-pointer h-13 rounded-xl border border-purple-300 focus:ring-2 focus:ring-purple-400 focus:outline-none">
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500" size={20} />
          <span className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            Chọn file .docx
          </span>
          <input
            type="file"
            accept=".docx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFileLien(f);
              setWeek(extractWeek(f.name));
            }}
            className="pl-10 pr-3 py-3 w-full rounded-xl border border-purple-300 focus:ring-2 focus:ring-purple-400 focus:outline-none opacity-0 absolute inset-0 cursor-pointer"
          />
        </label>

        {/* Week Input */}
        <label className="relative w-full block">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500" size={20} />
          <input
            type="number"
            placeholder="Tuần"
            value={week ?? ""}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="pl-10 pr-3 py-3 w-full rounded-xl border border-purple-300 focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
        </label>

        <div>
          Lời nhắn: <span className="text-gray-500">Chúc Người Yêu làm việc hiệu quả 😍😍😍!</span>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-white transition-colors
      ${exporting ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}
        >
          {exporting ? "Đang tạo..." : <>
            <Download size={20} /> Xuất LBG
          </>}
        </button>
      </div>
    </div>

  );
}
