#!/usr/bin/env python3
"""
Quick startup script for Increa Reader Server
"""

import uvicorn
import os

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3010))
    uvicorn.run(
        "increa_reader.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
