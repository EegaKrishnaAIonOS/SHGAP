"""T24/ADR-0033: the real receiver Alertmanager's local-rehearsal config
points at — logs every alert it's sent, to stdout, so `docker compose logs
alert-log-sink` is a real, verifiable record that alerting actually fires,
without needing a real Slack/PagerDuty account. A real deployment replaces
Alertmanager's webhook_configs with slack_configs/pagerduty_configs
instead of standing this up in production — see alertmanager.yml's own
comment and docs/deployment-guide.md.
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class AlertLogHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            payload = json.loads(body)
            for alert in payload.get("alerts", []):
                status = alert.get("status")
                name = alert.get("labels", {}).get("alertname")
                summary = alert.get("annotations", {}).get("summary")
                print(f"[ALERT] status={status} alertname={name} summary={summary}", flush=True)
        except json.JSONDecodeError:
            print(f"[ALERT] received non-JSON body: {body!r}", flush=True)
        self.send_response(200)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - matches base signature
        pass  # suppress the default per-request access log; the [ALERT] print above is the real signal


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 9095), AlertLogHandler).serve_forever()
