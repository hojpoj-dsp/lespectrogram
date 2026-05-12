#pragma once

#include <algorithm>
#include <cstdint>
#include <cstring>

// Fixed-stride draw command list. C++ writes; JS reads via Int32Array view.
//
// Each command is 8 i32 (32 bytes). Field meaning is type-specific:
//
//   slot   common      fillRect    strokeRect       fillText
//   [0]    type        1           2                3
//   [1]    x           x           x                x
//   [2]    y           y           y                y
//   [3]    -           w           w                fontSizePx
//   [4]    -           h           h                align (0=L 1=C 2=R)
//   [5]    color       RGBA        RGBA             RGBA (0xRRGGBBAA packed)
//   [6]    -           0           lineWidth        textOffset (into text[])
//   [7]    -           0           0                textLength
//
// Coordinates are in physical canvas pixels (caller has scaled by dpr).
struct DrawList
{
    static constexpr int32_t MAX_CMDS       = 4096;
    static constexpr int32_t TEXT_BYTES     = 16384;
    static constexpr int32_t CMD_STRIDE_I32 = 8;

    enum CmdType : int32_t
    {
        CMD_FILL_RECT   = 1,
        CMD_STROKE_RECT = 2,
        CMD_FILL_TEXT   = 3,
    };

    int32_t cmds[MAX_CMDS * CMD_STRIDE_I32];
    char    text[TEXT_BYTES];
    int32_t count   = 0;
    int32_t textOff = 0;

    void reset() { count = 0; textOff = 0; }

    int32_t* allocSlot()
    {
        if (count >= MAX_CMDS)
        {
            return nullptr;
        }
        int32_t* s = cmds + count * CMD_STRIDE_I32;
        ++count;
        return s;
    }

    void fillRect(int32_t x, int32_t y, int32_t w, int32_t h, uint32_t color)
    {
        int32_t* s = allocSlot();
        if (!s)
        {
            return;
        }
        s[0] = CMD_FILL_RECT;
        s[1] = x; s[2] = y; s[3] = w; s[4] = h;
        s[5] = static_cast<int32_t>(color);
        s[6] = 0; s[7] = 0;
    }

    void strokeRect(int32_t x, int32_t y, int32_t w, int32_t h,
                    int32_t lineWidth, uint32_t color)
    {
        int32_t* s = allocSlot();
        if (!s)
        {
            return;
        }
        s[0] = CMD_STROKE_RECT;
        s[1] = x; s[2] = y; s[3] = w; s[4] = h;
        s[5] = static_cast<int32_t>(color);
        s[6] = lineWidth; s[7] = 0;
    }

    void fillText(int32_t x, int32_t y, int32_t fontSizePx, int32_t align,
                  uint32_t color, const char* str, int32_t len)
    {
        len = std::max(0, len);
        if (textOff + len > TEXT_BYTES)
        {
            return;
        }
        int32_t* s = allocSlot();
        if (!s)
        {
            return;
        }
        s[0] = CMD_FILL_TEXT;
        s[1] = x; s[2] = y; s[3] = fontSizePx; s[4] = align;
        s[5] = static_cast<int32_t>(color);
        s[6] = textOff; s[7] = len;
        std::memcpy(text + textOff, str, len);
        textOff += len;
    }
};
