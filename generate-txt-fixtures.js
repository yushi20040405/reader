const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const OUT = path.join(__dirname, 'txt');
fs.mkdirSync(OUT, { recursive: true });

// ---------- 章节标题变体 ----------
const chapterLines = [
  '第一章 起始',
  '第1章 试炼',
  '第二章 风起',
  '第2章 云涌',
  '第三章 归途',
  '第3章 落幕',
];

// ---------- 生成器：带章节的正文 ----------
function withChapters(bodyFn) {
  return chapterLines.map((title, i) => `\n\n${title}\n\n${bodyFn(i)}`).join('\n');
}

// ---------- 生成器：无章节的连续文本 ----------
function plainBody(length = 3000) {
  return '这是一段没有章节标记的普通文本。'.repeat(Math.ceil(length / 18)).slice(0, length);
}

// ---------- 编码写入 ----------
function write(fileName, text, encoding) {
  const filePath = path.join(OUT, fileName);
  const buf = iconv.encode(text, encoding);
  fs.writeFileSync(filePath, buf);
  console.log(`written: ${fileName}  (${encoding}, ${buf.length} bytes)`);
}

// ========== 1. UTF-8 无 BOM，章节清晰 ==========
write(
  'utf8-chapter.txt',
  withChapters(i => `这是第 ${i + 1} 章的正文内容。`),
  'utf8'
);

// ========== 2. GBK，章节清晰 ==========
write(
  'gbk-chapter.txt',
  withChapters(i => `这是第 ${i + 1} 章的正文内容，用于测试 GBK 编码识别。`),
  'gbk'
);

// ========== 3. UTF-8 BOM，无章节标记（触发固定分节） ==========
const bomContent = plainBody(8000);
// iconv-lite 写 utf8 时不会自动加 BOM，手动加
const bomBuf = Buffer.concat([
  Buffer.from([0xef, 0xbb, 0xbf]),
  Buffer.from(bomContent, 'utf8'),
]);
fs.writeFileSync(path.join(OUT, 'utf8bom-nochapter.txt'), bomBuf);
console.log('written: utf8bom-nochapter.txt (utf8 + BOM, no chapter markers)');

// ========== 4. GB18030，序章 / 尾声 特殊词 ==========
const specialText = `序章\n\n这是序章的内容。\n\n第1章 开端\n\n正文一。\n\n尾声\n\n全书结束。`;
write('gb18030-special.txt', specialText, 'gb18030');

// ========== 5. 大文件（约 50MB，UTF-8，混合章节） ==========
const bigParts = [];
let total = 0;
let i = 0;
while (total < 50 * 1024 * 1024) {
  const title = i % 2 === 0 ? `第${i + 1}章 长卷` : `第${i + 1}节 小节`;
  const chunk = `\n\n${title}\n\n` + plainBody(2000);
  bigParts.push(chunk);
  total += Buffer.byteLength(chunk, 'utf8');
  i++;
}
write('large-50mb.txt', bigParts.join(''), 'utf8');