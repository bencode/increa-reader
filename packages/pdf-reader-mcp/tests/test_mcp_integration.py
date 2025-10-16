"""
Simple MCP integration tests
"""

from pdf_reader_server import mcp


class TestMCPServer:
    """Test basic MCP server functionality"""

    def test_server_initialization(self):
        """Test MCP server initializes"""
        assert mcp.name == "pdf-reader"
