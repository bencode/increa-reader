#!/usr/bin/env python3
"""
PDF页面处理：提取文本、图片、表格和数学公式，转换为Markdown
"""

import re
import tempfile
from pathlib import Path
from typing import Dict, List, Tuple, Any
import fitz  # PyMuPDF


class PDFPageProcessor:
    """PDF页面处理器"""

    def __init__(self, doc_path: str):
        self.doc = fitz.open(doc_path)
        self.temp_dir = Path(tempfile.gettempdir())

    def close(self):
        """关闭文档"""
        if self.doc:
            self.doc.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def _extract_page_content(self, page_num: int) -> Dict[str, Any]:
        """提取页面内容"""
        if page_num < 1 or page_num > self.doc.page_count:
            raise ValueError(f"Page {page_num} out of range (1-{self.doc.page_count})")

        page = self.doc[page_num - 1]

        # 获取页面尺寸
        rect = page.rect

        # 提取文本块
        text_blocks = page.get_text("dict")

        # 分析页面结构
        content_sections = []

        # 1. 检测表格
        tables = self._extract_tables(page)
        table_regions = [table["bbox"] for table in tables]

        # 2. 检测图片
        images = self._extract_images(page, page_num)

        # 3. 处理文本块，排除表格和图片区域
        text_content = self._process_text_blocks(text_blocks, table_regions, rect)

        # 4. 组合所有内容
        markdown_content = self._assemble_markdown(
            text_content, tables, images, page_num
        )

        return {
            "page": page_num,
            "markdown": markdown_content,
            "has_tables": len(tables) > 0,
            "has_images": len(images) > 0,
            "estimated_reading_time": len(markdown_content.split()) // 200  # 假设每分钟200词
        }

    def _extract_tables(self, page) -> List[Dict[str, Any]]:
        """提取表格"""
        tables = []

        try:
            # 使用PyMuPDF的表格检测
            table_finder = page.find_tables()

            for table_idx, table in enumerate(table_finder.tables):
                table_data = table.extract()

                # 转换为Markdown表格
                markdown_table = self._convert_table_to_markdown(table_data)

                tables.append({
                    "id": f"table_{table_idx + 1}",
                    "bbox": table.bbox,
                    "markdown": markdown_table,
                    "rows": len(table_data),
                    "cols": len(table_data[0]) if table_data else 0
                })

        except Exception as e:
            # 如果表格检测失败，尝试简单的网格检测
            pass

        return tables

    def _convert_table_to_markdown(self, table_data: List[List[str]]) -> str:
        """将表格数据转换为Markdown格式"""
        if not table_data:
            return ""

        # 处理表格数据
        processed_data = []
        max_cols = max(len(row) for row in table_data)

        for row in table_data:
            # 确保每行有相同数量的列
            processed_row = row + [""] * (max_cols - len(row))
            processed_data.append([cell.strip() for cell in processed_row])

        # 构建Markdown表格
        markdown_lines = []

        # 表头
        if processed_data:
            header = "| " + " | ".join(processed_data[0]) + " |"
            markdown_lines.append(header)

            # 分隔线
            separator = "|" + "|".join([" --- " for _ in processed_data[0]]) + "|"
            markdown_lines.append(separator)

            # 数据行
            for row in processed_data[1:]:
                data_row = "| " + " | ".join(row) + " |"
                markdown_lines.append(data_row)

        return "\n".join(markdown_lines)

    def _extract_images(self, page, page_num: int) -> List[Dict[str, Any]]:
        """提取图片"""
        images = []

        try:
            image_list = page.get_images()

            for img_idx, img in enumerate(image_list):
                # 获取图片
                xref = img[0]
                pix = fitz.Pixmap(self.doc, xref)

                # 跳过CMYK图像
                if pix.n - pix.alpha < 4:
                    # 保存图片到临时文件
                    img_filename = f"pdf_p{page_num}_img{img_idx + 1}.png"
                    img_path = self.temp_dir / img_filename
                    pix.save(img_path)

                    # 获取图片位置
                    img_rect = page.get_image_bbox(img)

                    images.append({
                        "id": f"image_{img_idx + 1}",
                        "path": str(img_path),
                        "bbox": img_rect,
                        "width": pix.width,
                        "height": pix.height,
                        "markdown": f"![图片{img_idx + 1}](/api/temp-image/{img_filename})"
                    })

                pix = None  # 释放内存

        except Exception as e:
            print(f"Error extracting images: {e}")

        return images

    def _process_text_blocks(self, text_blocks: Dict, table_regions: List, page_rect) -> List[Dict[str, Any]]:
        """处理文本块，识别段落、标题、公式"""
        content = []

        if "blocks" not in text_blocks:
            return content

        # 按y坐标排序文本块（从上到下）
        blocks = sorted(text_blocks["blocks"], key=lambda b: b["bbox"][1])

        for block in blocks:
            if block["type"] != 0:  # 0表示文本块
                continue

            # 检查是否在表格区域内
            block_rect = fitz.Rect(block["bbox"])
            in_table = any(block_rect.intersects(table_region) for table_region in table_regions)

            if in_table:
                continue

            # 提取文本
            block_text = ""
            if "lines" in block:
                for line in block["lines"]:
                    if "spans" in line:
                        line_text = ""
                        for span in line["spans"]:
                            line_text += span["text"]
                        block_text += line_text + "\n"

            block_text = block_text.strip()
            if not block_text:
                continue

            # 分析文本类型
            text_type = self._classify_text(block_text, block)

            content.append({
                "type": text_type,
                "text": block_text,
                "bbox": block["bbox"],
                "font_info": self._get_font_info(block)
            })

        return content

    def _classify_text(self, text: str, block: Dict) -> str:
        """分类文本类型：标题、段落、公式等"""
        # 检测数学公式（简单启发式）
        if self._is_math_formula(text):
            return "formula"

        # 检测标题（基于字体大小和文本特征）
        font_info = self._get_font_info(block)
        if font_info and font_info.get("size", 12) > 14:
            if text.strip().endswith(":") or len(text.strip()) < 100:
                return "heading"

        # 检测列表项
        if re.match(r'^\s*[-•*]\s+', text) or re.match(r'^\s*\d+\.\s+', text):
            return "list"

        # 默认为段落
        return "paragraph"

    def _is_math_formula(self, text: str) -> bool:
        """检测是否为数学公式"""
        # 简单的数学公式检测
        math_indicators = [
            r'\\frac\{', r'\\sqrt\{', r'\\sum\{', r'\\int\{',
            r'\{.*\}_\{.*\}',  # 下标
            r'\{.*\}\^\{.*\}',  # 上标
            r'\\alpha', r'\\beta', r'\\gamma', r'\\delta', r'\\theta', r'\\lambda', r'\\mu', r'\\pi', r'\\sigma', r'\\phi', r'\\omega',
            r'\\leq', r'\\geq', r'\\neq', r'\\approx', r'\\infty',
            r'\$.*\$'  # LaTeX数学模式
        ]

        for pattern in math_indicators:
            if re.search(pattern, text):
                return True

        # 如果文本包含大量数学符号且较短，可能是公式
        math_chars = set('∑∏∫√±≤≥≠∞∂∇∆αβγδεζηθικλμνξοπρστυφχψω')
        ratio = sum(1 for c in text if c in math_chars) / len(text) if text else 0

        return ratio > 0.2 and len(text.strip()) < 200

    def _get_font_info(self, block: Dict) -> Dict[str, Any]:
        """获取字体信息"""
        if "lines" not in block or not block["lines"]:
            return {}

        first_line = block["lines"][0]
        if "spans" not in first_line or not first_line["spans"]:
            return {}

        first_span = first_line["spans"][0]
        return {
            "size": first_span.get("size", 12),
            "flags": first_span.get("flags", 0),
            "font": first_span.get("font", "")
        }

    def _assemble_markdown(self, text_content: List[Dict], tables: List[Dict], images: List[Dict], page_num: int) -> str:
        """组装最终的Markdown内容"""
        markdown_parts = []

        # 按位置排序所有内容
        all_content = []

        # 添加文本内容
        for idx, item in enumerate(text_content):
            all_content.append({
                "type": "text",
                "subtype": item["type"],
                "content": item,
                "bbox": item["bbox"],
                "order": idx
            })

        # 添加表格
        for idx, table in enumerate(tables):
            all_content.append({
                "type": "table",
                "content": table,
                "bbox": table["bbox"],
                "order": idx
            })

        # 添加图片
        for idx, image in enumerate(images):
            all_content.append({
                "type": "image",
                "content": image,
                "bbox": image["bbox"],
                "order": idx
            })

        # 按y坐标排序
        all_content.sort(key=lambda x: x["bbox"][1])

        # 生成Markdown
        for item in all_content:
            if item["type"] == "text":
                markdown_parts.append(self._format_text_content(item["content"]))
            elif item["type"] == "table":
                markdown_parts.append(f"\n{item['content']['markdown']}\n")
            elif item["type"] == "image":
                markdown_parts.append(f"\n{item['content']['markdown']}\n")

        # 添加页面分隔符
        result = "\n".join(markdown_parts)
        if result.strip():
            result += f"\n\n---\n\n*第 {page_num} 页*\n"

        return result

    def _format_text_content(self, text_item: Dict) -> str:
        """格式化文本内容为Markdown"""
        text = text_item["text"]
        text_type = text_item["type"]

        if text_type == "heading":
            # 根据字体大小确定标题级别
            font_size = text_item.get("font_info", {}).get("size", 12)
            if font_size > 18:
                level = 1
            elif font_size > 16:
                level = 2
            elif font_size > 14:
                level = 3
            else:
                level = 4

            return f"\n{'#' * level} {text.strip()}\n"

        elif text_type == "formula":
            # 数学公式
            if "$" in text:
                return f"\n$$\n{text}\n$$\n"
            else:
                return f"\n`{text}`\n"

        elif text_type == "list":
            # 列表项，保持原有格式
            return f"\n{text}\n"

        else:
            # 普通段落
            return f"\n{text}\n"

    def render_page_svg(self, page_num: int) -> str:
        """渲染页面为SVG矢量图"""
        if page_num < 1 or page_num > self.doc.page_count:
            raise ValueError(f"Page {page_num} out of range (1-{self.doc.page_count})")

        page = self.doc[page_num - 1]
        return page.get_svg_image()


def extract_page_markdown(doc_path: str, page_num: int) -> Dict[str, Any]:
    """
    提取PDF页面的Markdown内容

    Args:
        doc_path: PDF文件路径
        page_num: 页码（1-based）

    Returns:
        Dict containing markdown content and metadata
    """
    processor = PDFPageProcessor(doc_path)
    try:
        return processor._extract_page_content(page_num)
    finally:
        processor.close()


def render_page_svg(doc_path: str, page_num: int) -> str:
    """
    渲染PDF页面为SVG矢量图

    Args:
        doc_path: PDF文件路径
        page_num: 页码（1-based）

    Returns:
        SVG content as string
    """
    processor = PDFPageProcessor(doc_path)
    try:
        return processor.render_page_svg(page_num)
    finally:
        processor.close()