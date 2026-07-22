import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { saveAs } from 'file-saver'
import type { ErrorItem } from '../types'

function dateText(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function imageFromDataUrl(dataUrl?: string): ImageRun | null {
  if (!dataUrl) return null
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/)
  if (!match) return null
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const type = (match[1] === 'jpeg' ? 'jpg' : match[1]) as 'jpg' | 'png' | 'gif'
  return new ImageRun({
    data: bytes,
    type,
    transformation: { width: 480, height: 300 },
  })
}

function labelLine(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: `${label}：`, bold: true, font: 'Microsoft YaHei' }),
      new TextRun({ text: value || '—', font: 'Microsoft YaHei' }),
    ],
  })
}

export async function exportRedoDocx(items: ErrorItem[]): Promise<void> {
  if (!items.length) throw new Error('请至少选择一道错题')
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: '沪学错题本 · 重做练习卷',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ['姓名：____________', `日期：${dateText(new Date().toISOString())}`, `共 ${items.length} 题`].map(
            (text) => new TableCell({ children: [new Paragraph({ text })] }),
          ),
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { after: 100 } }),
  ]

  items.forEach((item, index) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${index + 1}. [${item.subject}] ${item.title}`, bold: true, size: 26, font: 'Microsoft YaHei' }),
        ],
        spacing: { before: 180, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: item.question || '请根据下图作答。', size: 22, font: 'Microsoft YaHei' })],
        spacing: { after: 100 },
      }),
    )
    const image = imageFromDataUrl(item.imageDataUrl)
    if (image) children.push(new Paragraph({ children: [image], alignment: AlignmentType.CENTER }))
    children.push(
      new Paragraph({ text: '答：', spacing: { before: 100 } }),
      new Paragraph({ text: '________________________________________________________________________________' }),
      new Paragraph({ text: '________________________________________________________________________________' }),
      new Paragraph({ text: '________________________________________________________________________________', spacing: { after: 160 } }),
    )
  })

  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      text: '答案与错因分析',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  )

  items.forEach((item, index) => {
    children.push(
      new Paragraph({
        text: `${index + 1}. ${item.title}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 100 },
      }),
      labelLine('知识点', item.knowledgePoints.join('、')),
      labelLine('错误类型', item.mistakeType),
      labelLine('正确答案', item.correctAnswer),
      labelLine('正确思路', item.correctSolution),
      labelLine('错因定位', item.rootCause),
      labelLine('改进建议', item.improvementAdvice),
    )
  })

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Microsoft YaHei', size: 22 },
          paragraph: { spacing: { line: 360 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  })
  saveAs(await Packer.toBlob(document), `沪学错题重做卷_${new Date().toISOString().slice(0, 10)}.docx`)
}
