import unittest
from unittest.mock import AsyncMock, patch

import main


class FakeRequest:
    def __init__(self, payload):
        self.payload = payload

    async def json(self):
        return self.payload


def _conversation(**overrides):
    data = {
        "id": 42,
        "status": "pending",
        "custom_attributes": {},
        "meta": {},
    }
    data.update(overrides)
    return data


def _payload(message_type="incoming", conversation=None, **overrides):
    data = {
        "event": "message_created",
        "id": 100,
        "message_type": message_type,
        "content": "hello",
        "private": False,
        "account": {"id": 1},
        "conversation": conversation or _conversation(),
        "inbox": {"id": 7},
    }
    data.update(overrides)
    return data


class OperatorTakeoverTests(unittest.IsolatedAsyncioTestCase):
    async def test_human_outgoing_marks_operator_takeover_without_llm(self):
        payload = _payload(
            message_type="outgoing",
            sender={"type": "user", "id": 9},
            content="Я оператор, помогу вам",
        )

        with patch.object(
            main, "mark_operator_takeover", AsyncMock()
        ) as takeover_mock, patch.object(
            main,
            "ask_openclaw",
            AsyncMock(),
        ) as llm_mock:
            result = await main.webhook(FakeRequest(payload))

        self.assertEqual(result["reason"], "operator takeover")
        takeover_mock.assert_awaited_once_with(1, 42, ensure_open=True)
        llm_mock.assert_not_called()

    async def test_agent_bot_outgoing_does_not_mark_operator_takeover(self):
        payload = _payload(
            message_type="outgoing",
            sender={"type": "agent_bot", "id": 2},
            content="AI reply",
        )

        with patch.object(
            main, "mark_operator_takeover", AsyncMock()
        ) as takeover_mock:
            result = await main.webhook(FakeRequest(payload))

        self.assertEqual(result["reason"], "not incoming")
        takeover_mock.assert_not_called()

    async def test_incoming_assigned_to_human_is_ignored_without_llm(self):
        conversation = _conversation(
            meta={"assignee": {"id": 9, "name": "Operator"}},
            status="open",
        )
        payload = _payload(conversation=conversation, content="Вы тут?")

        with patch.object(
            main, "mark_operator_takeover", AsyncMock()
        ) as takeover_mock, patch.object(
            main,
            "ask_openclaw",
            AsyncMock(),
        ) as llm_mock:
            result = await main.webhook(FakeRequest(payload))

        self.assertEqual(result["reason"], "assigned_to_operator")
        takeover_mock.assert_awaited_once_with(1, 42, ensure_open=False)
        llm_mock.assert_not_called()

    async def test_unassigned_incoming_still_reaches_llm(self):
        payload = _payload(content="Как оплатить подписку?")

        with patch.object(
            main,
            "_is_duplicate_incoming",
            AsyncMock(return_value=False),
        ), patch.object(
            main,
            "_account_outage_reply",
            AsyncMock(return_value=None),
        ), patch.object(
            main,
            "park_conversation_for_ai",
            AsyncMock(),
        ), patch.object(
            main,
            "_resolve_system_prompt",
            AsyncMock(return_value=("system", "test")),
        ), patch.object(
            main,
            "_build_recent_history",
            AsyncMock(return_value=[]),
        ), patch.object(
            main,
            "ask_openclaw",
            AsyncMock(return_value="Ответ ИИ"),
        ) as llm_mock, patch.object(
            main, "send_reply", AsyncMock()
        ), patch.object(
            main, "_classify_first_message_topic", AsyncMock()
        ):
            result = await main.webhook(FakeRequest(payload))

        self.assertEqual(result["status"], "ok")
        llm_mock.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
