#!/usr/bin/env python3
"""
JediRe DevOps Alert Handler
Sends alerts to Leon via Telegram
"""

import sys
import json
from datetime import datetime

def format_alert(severity, title, details):
    """Format an alert message"""
    
    emoji_map = {
        'critical': '🚨',
        'warning': '⚠️',
        'info': 'ℹ️',
        'success': '✅'
    }
    
    emoji = emoji_map.get(severity, '📢')
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    message = f"{emoji} **JediRe {severity.upper()}**\n\n"
    message += f"**{title}**\n\n"
    message += f"{details}\n\n"
    message += f"_Time: {timestamp}_"
    
    return message

def send_alert(severity, title, details):
    """
    Send alert via Clawdbot message tool
    
    Note: This is called from within a Clawdbot agent session,
    so we just output the formatted message and let the agent
    handle sending it via the message tool.
    """
    
    message = format_alert(severity, title, details)
    
    # Output in a format the agent can easily parse
    print(json.dumps({
        'alert': True,
        'severity': severity,
        'title': title,
        'message': message
    }))

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: alert.py <severity> <title> <details>")
        sys.exit(1)
    
    severity = sys.argv[1]
    title = sys.argv[2]
    details = sys.argv[3]
    
    send_alert(severity, title, details)
