"""
Test script for PDF MCP integration with Claude Agent SDK
"""

import asyncio

from claude_agent_sdk import ClaudeAgentOptions, create_sdk_mcp_server, query

from increa_reader.pdf_tools import (
    close_pdf,
    extract_text,
    open_pdf,
    page_count,
    render_page_png,
    search_text,
)


async def main():
    # Create PDF MCP server
    print("Creating PDF MCP server...")
    pdf_server = create_sdk_mcp_server(
        name="pdf-reader",
        version="1.0.0",
        tools=[
            open_pdf,
            page_count,
            extract_text,
            render_page_png,
            search_text,
            close_pdf,
        ],
    )
    print(f"✓ Server created: {pdf_server}\n")

    # Configure options
    def stderr_callback(line: str):
        print(f"[CLI STDERR] {line}")

    options = ClaudeAgentOptions(
        cwd="/Users/bencode/work/brain2/pages",
        mcp_servers={"pdf-reader": pdf_server},
        allowed_tools=[
            "Bash",
            "Read",
            "mcp__pdf-reader__open_pdf",
            "mcp__pdf-reader__page_count",
            "mcp__pdf-reader__extract_text",
            "mcp__pdf-reader__search_text",
            "mcp__pdf-reader__close_pdf",
        ],
        permission_mode="bypassPermissions",
        stderr=stderr_callback,
    )

    print("Starting query...")
    print("=" * 80)

    # Test query
    prompt = "使用 PDF MCP 工具打开 rl/res/RLbook2018.pdf，告诉我它有多少页"

    async for message in query(prompt=prompt, options=options):
        msg_type = type(message).__name__
        print(f"[{msg_type}]", end=" ")

        if msg_type == "SystemMessage":
            print(f"subtype={message.subtype}")
            if message.subtype == "init":
                print(f"  MCP servers: {message.data.get('mcp_servers')}")
        elif msg_type == "AssistantMessage":
            if message.content:
                for block in message.content:
                    if hasattr(block, "text"):
                        print(f"Text: {block.text[:100]}")
                    elif hasattr(block, "name"):
                        print(f"Tool: {block.name}({block.input})")
        elif msg_type == "ResultMessage":
            print(f"Result: {message.result[:100] if message.result else 'None'}")
        else:
            print()


if __name__ == "__main__":
    asyncio.run(main())
