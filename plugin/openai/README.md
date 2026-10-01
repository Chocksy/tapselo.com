# ChatGPT plugin package

Package for the OpenAI plugin directory ("With MCP" path). Server: https://tapselo.com/mcp.

Build the ZIP from this folder:

    cd plugin/openai && zip -r ../../tapselo-openai-plugin.zip plugin.json mcp.json assets

Upload it at https://platform.openai.com/plugins (Create plugin > With MCP). The portal also asks for:

- domain verification: put the token in `public/.well-known/openai-apps-challenge` (plain text, token only) and deploy;
- a demo recording URL (`review.demo_recording_url`), reviewer-accessible.

Docs: https://developers.openai.com/plugins/deploy/submission
