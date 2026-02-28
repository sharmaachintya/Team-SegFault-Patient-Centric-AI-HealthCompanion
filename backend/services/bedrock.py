"""AI Client - Supports both direct Anthropic API and AWS Bedrock."""
import json
import base64
import logging
from abc import ABC, abstractmethod
from config import config

logger = logging.getLogger(__name__)


class AIClient(ABC):
    """Abstract AI client interface."""

    @abstractmethod
    def converse(self, messages, system_prompt, tools=None, max_tokens=4096, temperature=0.3):
        pass

    @abstractmethod
    def converse_stream(self, messages, system_prompt, tools=None, max_tokens=4096, temperature=0.3):
        pass

    @staticmethod
    @abstractmethod
    def create_text_message(role, text):
        pass

    @staticmethod
    @abstractmethod
    def create_image_message(role, text, image_bytes, media_type="image/jpeg"):
        pass

    @staticmethod
    @abstractmethod
    def extract_response(response):
        pass

    @staticmethod
    def create_tool_result_message(tool_use_id, result):
        pass

    @staticmethod
    @abstractmethod
    def build_tool_result_block(tool_use_id, result_text):
        """Build a single tool result content block."""
        pass

    @staticmethod
    @abstractmethod
    def build_tool_use_block(tool_use_id, name, tool_input):
        """Build a single tool use content block for assistant messages."""
        pass


# ==================================================================
# Anthropic Direct API Client
# ==================================================================

class AnthropicClient(AIClient):
    """Client for direct Anthropic Messages API."""

    def __init__(self):
        import anthropic
        self.client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        self.model = config.ANTHROPIC_MODEL
        logger.info(f"Initialized Anthropic client with model: {self.model}")

    def _convert_tools(self, bedrock_tools):
        """Convert Bedrock tool format to Anthropic format."""
        if not bedrock_tools:
            return None
        anthropic_tools = []
        for t in bedrock_tools:
            spec = t.get("toolSpec", t)
            anthropic_tools.append({
                "name": spec["name"],
                "description": spec["description"],
                "input_schema": spec.get("inputSchema", {}).get("json", spec.get("input_schema", {})),
            })
        return anthropic_tools

    def converse(self, messages, system_prompt, tools=None, max_tokens=4096, temperature=0.3):
        """Call Anthropic Messages API."""
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": messages,
        }
        converted_tools = self._convert_tools(tools)
        if converted_tools:
            kwargs["tools"] = converted_tools

        try:
            response = self.client.messages.create(**kwargs)
            # Convert to a dict format similar to Bedrock for extract_response
            return {
                "output": {
                    "message": {
                        "role": response.role,
                        "content": [self._block_to_dict(b) for b in response.content],
                    }
                },
                "stopReason": response.stop_reason,
            }
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise

    def converse_stream(self, messages, system_prompt, tools=None, max_tokens=4096, temperature=0.3):
        """Stream from Anthropic Messages API."""
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": messages,
        }
        converted_tools = self._convert_tools(tools)
        if converted_tools:
            kwargs["tools"] = converted_tools

        try:
            with self.client.messages.stream(**kwargs) as stream:
                current_tool_id = None
                current_tool_name = None
                tool_input_json = ""

                for event in stream:
                    if event.type == "content_block_start":
                        block = event.content_block
                        if hasattr(block, 'type') and block.type == "tool_use":
                            current_tool_id = block.id
                            current_tool_name = block.name
                            tool_input_json = ""
                            yield {"type": "tool_use_start", "id": block.id, "name": block.name}

                    elif event.type == "content_block_delta":
                        delta = event.delta
                        if hasattr(delta, 'type'):
                            if delta.type == "text_delta":
                                yield {"type": "text", "text": delta.text}
                            elif delta.type == "input_json_delta":
                                tool_input_json += delta.partial_json
                                yield {"type": "tool_use_delta", "input_json": delta.partial_json}

                    elif event.type == "content_block_stop":
                        if current_tool_name:
                            yield {"type": "tool_use_end", "id": current_tool_id, "name": current_tool_name, "input_json": tool_input_json}
                            current_tool_id = None
                            current_tool_name = None
                            tool_input_json = ""

                    elif event.type == "message_stop":
                        pass

                # Final done event
                stop_reason = getattr(stream, '_MessageStream__final_message_snapshot', None)
                sr = "end_turn"
                if stop_reason and hasattr(stop_reason, 'stop_reason'):
                    sr = stop_reason.stop_reason
                yield {"type": "done", "stop_reason": sr}

        except Exception as e:
            logger.error(f"Anthropic Stream API error: {e}")
            raise

    def _block_to_dict(self, block):
        """Convert an Anthropic content block to dict."""
        if block.type == "text":
            return {"text": block.text}
        elif block.type == "tool_use":
            return {
                "toolUse": {
                    "toolUseId": block.id,
                    "name": block.name,
                    "input": block.input,
                }
            }
        return {}

    @staticmethod
    def create_text_message(role, text):
        return {"role": role, "content": [{"type": "text", "text": text}]}

    @staticmethod
    def create_image_message(role, text, image_bytes, media_type="image/jpeg"):
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        return {
            "role": role,
            "content": [
                {"type": "text", "text": text},
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64,
                    }
                }
            ]
        }

    @staticmethod
    def create_tool_result_message(tool_use_id, result):
        return {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": result,
                }
            ]
        }

    @staticmethod
    def build_tool_result_block(tool_use_id, result_text):
        return {"type": "tool_result", "tool_use_id": tool_use_id, "content": result_text}

    @staticmethod
    def build_tool_use_block(tool_use_id, name, tool_input):
        return {"type": "tool_use", "id": tool_use_id, "name": name, "input": tool_input}

    @staticmethod
    def extract_response(response):
        output = response.get("output", {})
        message = output.get("message", {})
        content_blocks = message.get("content", [])
        stop_reason = response.get("stopReason", "")

        text_parts = []
        tool_calls = []

        for block in content_blocks:
            if "text" in block:
                text_parts.append(block["text"])
            elif "toolUse" in block:
                tool_calls.append({
                    "id": block["toolUse"]["toolUseId"],
                    "name": block["toolUse"]["name"],
                    "input": block["toolUse"]["input"],
                })

        return {
            "text": "\n".join(text_parts) if text_parts else "",
            "tool_calls": tool_calls,
            "stop_reason": stop_reason,
            "role": message.get("role", "assistant"),
        }


# ==================================================================
# AWS Bedrock Client
# ==================================================================

class BedrockClient(AIClient):
    """Client for Amazon Bedrock Converse API."""

    def __init__(self):
        import boto3
        self.client = boto3.client("bedrock-runtime", region_name=config.AWS_REGION)
        self.model_id = config.BEDROCK_MODEL_ID
        logger.info(f"Initialized Bedrock client with model: {self.model_id}")

    def converse(self, messages, system_prompt, tools=None, max_tokens=4096, temperature=0.3):
        kwargs = {
            "modelId": self.model_id,
            "messages": messages,
            "system": [{"text": system_prompt}],
            "inferenceConfig": {"maxTokens": max_tokens, "temperature": temperature},
        }
        if tools:
            kwargs["toolConfig"] = {"tools": tools}

        try:
            response = self.client.converse(**kwargs)
            return response
        except Exception as e:
            logger.error(f"Bedrock Converse API error: {e}")
            raise

    def converse_stream(self, messages, system_prompt, tools=None, max_tokens=4096, temperature=0.3):
        kwargs = {
            "modelId": self.model_id,
            "messages": messages,
            "system": [{"text": system_prompt}],
            "inferenceConfig": {"maxTokens": max_tokens, "temperature": temperature},
        }
        if tools:
            kwargs["toolConfig"] = {"tools": tools}

        try:
            response = self.client.converse_stream(**kwargs)
            stream = response.get("stream", [])

            current_tool_id = None
            current_tool_name = None
            tool_input_json = ""

            for event in stream:
                if "contentBlockStart" in event:
                    start = event["contentBlockStart"].get("start", {})
                    if "toolUse" in start:
                        current_tool_id = start["toolUse"]["toolUseId"]
                        current_tool_name = start["toolUse"]["name"]
                        tool_input_json = ""
                        yield {"type": "tool_use_start", "id": current_tool_id, "name": current_tool_name}

                elif "contentBlockDelta" in event:
                    delta = event["contentBlockDelta"].get("delta", {})
                    if "text" in delta:
                        yield {"type": "text", "text": delta["text"]}
                    elif "toolUse" in delta:
                        tool_input_json += delta["toolUse"].get("input", "")
                        yield {"type": "tool_use_delta", "input_json": delta["toolUse"].get("input", "")}

                elif "contentBlockStop" in event:
                    if current_tool_name:
                        yield {"type": "tool_use_end", "id": current_tool_id, "name": current_tool_name, "input_json": tool_input_json}
                        current_tool_id = None
                        current_tool_name = None
                        tool_input_json = ""

                elif "messageStop" in event:
                    stop_reason = event["messageStop"].get("stopReason", "end_turn")
                    yield {"type": "done", "stop_reason": stop_reason}

        except Exception as e:
            logger.error(f"Bedrock Stream API error: {e}")
            raise

    @staticmethod
    def create_text_message(role, text):
        return {"role": role, "content": [{"text": text}]}

    @staticmethod
    def create_image_message(role, text, image_bytes, media_type="image/jpeg"):
        return {
            "role": role,
            "content": [
                {"text": text},
                {"image": {"format": media_type.split("/")[-1], "source": {"bytes": image_bytes}}}
            ]
        }

    @staticmethod
    def create_tool_result_message(tool_use_id, result):
        return {
            "role": "user",
            "content": [{"toolResult": {"toolUseId": tool_use_id, "content": [{"text": result}]}}]
        }

    @staticmethod
    def build_tool_result_block(tool_use_id, result_text):
        return {"toolResult": {"toolUseId": tool_use_id, "content": [{"text": result_text}]}}

    @staticmethod
    def build_tool_use_block(tool_use_id, name, tool_input):
        return {"toolUse": {"toolUseId": tool_use_id, "name": name, "input": tool_input}}

    @staticmethod
    def extract_response(response):
        output = response.get("output", {})
        message = output.get("message", {})
        content_blocks = message.get("content", [])
        stop_reason = response.get("stopReason", "")

        text_parts = []
        tool_calls = []

        for block in content_blocks:
            if "text" in block:
                text_parts.append(block["text"])
            elif "toolUse" in block:
                tool_calls.append({
                    "id": block["toolUse"]["toolUseId"],
                    "name": block["toolUse"]["name"],
                    "input": block["toolUse"]["input"],
                })

        return {
            "text": "\n".join(text_parts) if text_parts else "",
            "tool_calls": tool_calls,
            "stop_reason": stop_reason,
            "role": message.get("role", "assistant"),
        }


# ==================================================================
# Factory
# ==================================================================

def create_ai_client() -> AIClient:
    """Create the appropriate AI client based on config."""
    if config.AI_PROVIDER == "anthropic":
        return AnthropicClient()
    else:
        return BedrockClient()
