import sys

path = sys.argv[1]
with open(path, 'r') as f:
    lines = f.readlines()

out = []
for i, line in enumerate(lines):
    out.append(line)
    # Insert stamp after the Step 9 comment line
    if line.strip() == "// ── Step 9: Create draft deal ────────────────────────────────────────":
        out.append("    const stamp = stampProvenance({\n")
        out.append("      ingestionSource: 'email_intake',\n")
        out.append("      userId: user_id,\n")
        out.append("      rawSourceRef: message_id,\n")
        out.append("      documentSource: 'email',\n")
        out.append("    });\n")
    # Append stamp argument to createDealDraft call
    if "fit_breakdown: fitScore.fit_breakdown," in line:
        # Check next line is the closing }); and replace it with just }, stamp);
        # But we can't look ahead easily. Instead, find the line that closes the object and add stamp.
        pass

# Second pass: find the closing of createDealDraft args and inject stamp
with open(path, 'r') as f:
    content = f.read()

# Replace the object closing followed by ); with }, stamp);
old = """        fit_breakdown: fitScore.fit_breakdown,
      });
    });"""
new = """        fit_breakdown: fitScore.fit_breakdown,
      }, stamp);
    });"""
content = content.replace(old, new)

with open(path, 'w') as f:
    f.write(content)

print('Done')
