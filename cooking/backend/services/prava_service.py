import json
import os
import re
import subprocess

from backend.config import PRAVA_SKILL_VERSION


class PravaService:
    """Wraps the Prava CLI for session management and payment.

    The Prava CLI handles all sensitive operations:
    - Agent linking (prava setup)
    - Session creation (prava sessions create)
    - Polling for approval (prava sessions poll)
    - Tokenized credential issuance

    The agent NEVER handles raw card numbers. Prava returns a single-use
    Visa network token + cryptogram + expiry for checkout.
    """

    def __init__(self):
        self.skill_version = PRAVA_SKILL_VERSION

    async def check_status(self) -> dict:
        """Check Prava agent link status.

        Returns one of: active, pending, not_configured, expired, unknown
        """
        result = self._run_cli(["status"])
        output = result.lower()

        if "active" in output:
            status = "active"
        elif "pending" in output:
            status = "pending"
        elif "no agent configured" in output:
            status = "not_configured"
        elif "link expired" in output:
            status = "expired"
        else:
            status = "unknown"

        return {"status": status, "raw": result}

    async def setup_agent(
        self,
        name: str = "Claude Code",
        platform: str = "claude-code",
        description: str = "CookCart grocery agent",
    ) -> dict:
        """Initialize agent linking with Prava.

        Returns the link URL for user approval.
        """
        result = self._run_cli(
            [
                "setup",
                "--name",
                name,
                "--platform",
                platform,
                "--description",
                description,
            ]
        )

        link_url = self._extract(result, r"(https://pay\.prava\.space/\S+)")
        return {"link_url": link_url, "raw": result}

    async def poll_setup(self) -> dict:
        """Poll for agent link approval (up to 15 min)."""
        result = self._run_cli(["setup", "poll"], timeout=960)
        linked = "linked" in result.lower()
        agent_id = self._extract(result, r"Agent ID:\s*(\S+)")
        return {"linked": linked, "agent_id": agent_id, "raw": result}

    async def create_session(
        self,
        total_amount: str,
        currency: str,
        merchant_name: str,
        merchant_url: str,
        merchant_country: str,
        products: list[dict],
    ) -> dict:
        """Create a Prava payment session.

        Returns session_id and payment_url for user approval.
        """
        cmd = [
            "sessions",
            "create",
            "--total-amount",
            total_amount,
            "--currency",
            currency,
            "--merchant-name",
            merchant_name,
            "--merchant-url",
            merchant_url,
            "--merchant-country",
            merchant_country,
        ]
        for product in products:
            cmd.extend(["--product", json.dumps(product)])

        result = self._run_cli(cmd)

        session_id = self._extract(result, r"Session ID:\s*(\S+)")
        payment_url = self._extract(result, r"Payment URL:\s*(\S+)")

        return {"session_id": session_id, "payment_url": payment_url, "raw": result}

    async def poll_session(self, session_id: str) -> dict:
        """Poll for payment approval. Returns tokenized credentials.

        BLOCKS until user approves via passkey (up to 10 min).
        Returns: token (card number), cryptogram (CVV), expiry
        """
        result = self._run_cli(
            ["sessions", "poll", "--session-id", session_id],
            timeout=660,
        )

        token = self._extract(result, r"Token:\s*(\d{16})")
        cryptogram = self._extract(result, r"Cryptogram:\s*(\d{3})")
        expiry = self._extract(result, r"Expiry:\s*(\d{2}/\d{4})")

        if token and cryptogram:
            return {
                "status": "approved",
                "token": token,
                "cryptogram": cryptogram,
                "expiry": expiry,
            }

        if "expired" in result.lower():
            return {"status": "expired", "raw": result}

        return {"status": "failed", "raw": result}

    async def create_zepto_session(
        self, total_amount: float, cart_description: str
    ) -> dict:
        """Create Prava session specifically for Zepto checkout."""
        return await self.create_session(
            total_amount=f"{total_amount:.2f}",
            currency="INR",
            merchant_name="Zepto",
            merchant_url="https://www.zeptonow.com",
            merchant_country="IN",
            products=[
                {
                    "description": cart_description,
                    "unit_price": f"{total_amount:.2f}",
                    "quantity": 1,
                }
            ],
        )

    async def create_swiggy_session(
        self, total_amount: float, cart_description: str
    ) -> dict:
        """Create Prava session specifically for Swiggy checkout."""
        return await self.create_session(
            total_amount=f"{total_amount:.2f}",
            currency="INR",
            merchant_name="Swiggy",
            merchant_url="https://www.swiggy.com",
            merchant_country="IN",
            products=[
                {
                    "description": cart_description,
                    "unit_price": f"{total_amount:.2f}",
                    "quantity": 1,
                }
            ],
        )

    def _run_cli(self, args: list[str], timeout: int = 30) -> str:
        """Execute a Prava CLI command."""
        env = {
            **os.environ,
            "PRAVA_SKILL_VERSION": self.skill_version,
        }
        cmd = ["prava"] + args
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, env=env
        )
        # Exit 0 = success, 2 = agent not configured (informational)
        if result.returncode not in (0, 2):
            raise RuntimeError(
                f"Prava CLI error (exit {result.returncode}): "
                f"{result.stderr or result.stdout}"
            )
        return result.stdout + result.stderr

    def _extract(self, text: str, pattern: str) -> str | None:
        match = re.search(pattern, text)
        return match.group(1) if match else None
