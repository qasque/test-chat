import unittest
from unittest.mock import AsyncMock, patch

import main


class TopicClassificationTests(unittest.IsolatedAsyncioTestCase):
    def test_extract_json_object_from_plain_json(self):
        parsed = main._extract_json_object('{"existing_topic_id": 7, "new_topic_name": null}')
        self.assertEqual(parsed["existing_topic_id"], 7)

    def test_extract_json_object_from_wrapped_text(self):
        parsed = main._extract_json_object(
            'Result:\n```json\n{"existing_topic_id": null, "new_topic_name": "Проблема оплаты"}\n```'
        )
        self.assertIsNone(parsed["existing_topic_id"])
        self.assertEqual(parsed["new_topic_name"], "Проблема оплаты")

    def test_meaningful_filter_skips_greeting(self):
        self.assertFalse(main.is_meaningful_client_message("Привет"))
        self.assertFalse(main.is_meaningful_client_message("Добрый день"))

    def test_meaningful_filter_accepts_problem_statement(self):
        self.assertTrue(main.is_meaningful_client_message("не работает vpn"))
        self.assertTrue(main.is_meaningful_client_message("нужно отменить автопродление и вернуть деньги"))

    async def test_classify_skips_non_meaningful_message(self):
        with patch.object(main, "_fetch_topic_context", AsyncMock(return_value={
            "support_topic": None,
            "incoming_public_messages_count": 1,
            "topics": [],
        })), patch.object(main, "_classify_topic_with_openclaw", AsyncMock()) as classify_mock:
            await main._classify_first_message_topic(1, 12, "session", "привет")
            classify_mock.assert_not_called()

    async def test_classify_assigns_topic_on_first_meaningful_message(self):
        with patch.object(main, "_fetch_topic_context", AsyncMock(return_value={
            "support_topic": None,
            "incoming_public_messages_count": 2,
            "topics": [{"id": 3, "name": "Не подключается VPN"}],
        })), patch.object(
            main,
            "_classify_topic_with_openclaw",
            AsyncMock(return_value=(3, None)),
        ), patch.object(main, "_assign_topic", AsyncMock()) as assign_mock:
            await main._classify_first_message_topic(2, 21, "session", "vpn не подключается")
            assign_mock.assert_awaited_once()

    async def test_classify_skips_when_topic_already_assigned(self):
        with patch.object(main, "_fetch_topic_context", AsyncMock(return_value={
            "support_topic": {"id": 11, "name": "Проблема с оплатой"},
            "incoming_public_messages_count": 3,
            "topics": [],
        })), patch.object(main, "_classify_topic_with_openclaw", AsyncMock()) as classify_mock:
            await main._classify_first_message_topic(2, 21, "session", "нужно отменить автопродление")
            classify_mock.assert_not_called()

    async def test_classify_does_not_raise_on_error(self):
        with patch.object(main, "_fetch_topic_context", AsyncMock(return_value={
            "support_topic": None,
            "incoming_public_messages_count": 2,
            "topics": [],
        })), patch.object(
            main,
            "_classify_topic_with_openclaw",
            AsyncMock(side_effect=RuntimeError("timeout")),
        ):
            await main._classify_first_message_topic(2, 21, "session", "vpn не подключается")


if __name__ == "__main__":
    unittest.main()
