import { useEffect, useRef, useState } from "react";
import { Film, ImagePlus, Mic, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrankMark } from "@/components/frank/mark";
import { ImageViewer } from "@/components/frank/image-viewer";
import { fetchFrankStatus, requestFrankReply } from "@/lib/frank-client";
import { HEADER_LINE, INTRO_BODY, INTRO_TITLE, OFFLINE_NOTE } from "@/lib/frank-copy";
import { CLIP_CAPTION, CLIP_FRAME_COUNT, clipCaptionForModel, sniffClip } from "@/lib/frank-clip";
import { prepareChatImage } from "@/lib/frank-image";
import {
  MAX_IMAGES_PER_MESSAGE,
  MEDIA_COUNT_ERROR,
  sniffImageKind,
  type ChatImage,
} from "@/lib/frank-media";
import {
  canRecognize,
  canRecord,
  framesFromClip,
  playReply,
  startRecognition,
  startRecording,
  stopPlayback,
  transcribeNote,
  unlockTalkAudio,
  type ListenSession,
} from "@/lib/frank-talk";
import {
  loadMood,
  loadThread,
  MAX_CHARS,
  MAX_THREAD,
  newMessage,
  saveMood,
  saveThread,
  type ChatMessage,
} from "@/lib/frank";
import { MOODS, type Mood } from "@/lib/frank-policy";
import {
  FRANK_VOICES,
  isFrankVoice,
  loadSpeak,
  loadVoice,
  saveSpeak,
  saveVoice,
  type FrankVoiceId,
} from "@/lib/frank-voice";

const fieldClass =
  "w-full resize-none rounded-lg border border-line bg-paper px-3 py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:border-sienna focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sienna";

const TONE_LABEL: Record<Mood, string> = {
  sweet: "Sweet",
  playful: "Playful",
  spicy: "Spicy",
};

const TONE_HINT: Record<Mood, string> = {
  sweet: "Tender and unhurried.",
  playful: "Teasing, then warm.",
  spicy: "Direct, when you ask for it.",
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";
const CLIP_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v";

// ... rest of file truncated in this call for brevity; full content will be handled separately if needed
