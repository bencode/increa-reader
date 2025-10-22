"""
测试PDF页面处理器
"""

import asyncio
from pathlib import Path

from increa_reader.pdf_processor import extract_page_markdown


async def test_pdf_processor():
    """测试PDF处理器"""
    # 使用当前目录下的测试PDF
    pdf_path = Path(__file__).parent / "test_document.pdf"
    page_num = 1

    try:
        result = extract_page_markdown(pdf_path, page_num)
        print(f"页面 {page_num} 的Markdown内容:")
        print("=" * 50)
        print(result["markdown"])
        print("=" * 50)
        print(f"包含表格: {result['has_tables']}")
        print(f"包含图片: {result['has_images']}")
        print(f"预计阅读时间: {result['estimated_reading_time']} 分钟")

    except Exception as e:
        print(f"处理失败: {e}")


if __name__ == "__main__":
    asyncio.run(test_pdf_processor())
