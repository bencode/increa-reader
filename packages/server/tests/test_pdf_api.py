"""
测试PDF API接口
"""

import asyncio
from pathlib import Path

from increa_reader.pdf_processor import extract_page_markdown


async def test_pdf_api():
    """测试PDF API功能"""
    # 使用测试PDF
    pdf_path = Path(__file__).parent / "test_document.pdf"

    if not pdf_path.exists():
        print(f"测试PDF文件 {pdf_path} 不存在")
        return

    print("=== 测试PDF处理器 ===")

    # 测试第1页
    try:
        result = extract_page_markdown(pdf_path, 1)
        print(f"✓ 第1页处理成功")
        print(f"  - 页码: {result['page']}")
        print(f"  - 包含表格: {result['has_tables']}")
        print(f"  - 包含图片: {result['has_images']}")
        print(f"  - 预计阅读时间: {result['estimated_reading_time']} 分钟")
        print(f"  - Markdown长度: {len(result['markdown'])} 字符")
        print(f"\n--- Markdown内容预览 ---")
        print(
            result["markdown"][:300] + "..."
            if len(result["markdown"]) > 300
            else result["markdown"]
        )
        print("---\n")

    except Exception as e:
        print(f"✗ 第1页处理失败: {e}")
        return

    print("=== 测试完成 ===")


if __name__ == "__main__":
    asyncio.run(test_pdf_api())
