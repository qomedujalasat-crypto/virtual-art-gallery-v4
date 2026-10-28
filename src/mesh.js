'use strict';

const loadTexture = async (texture, url) => {
    const result = await fetch(url);
    const blob = await result.blob();
    const data = await createImageBitmap(blob);
    texture({data,
        wrapS: 'repeat',
        wrapT: 'repeat'
    });
};

module.exports = (regl, data, useReflexion) => {
    const wallTexture = regl.texture();
    const floorTexture = regl.texture();
    const parkTexture = regl.texture();
    loadTexture(wallTexture, "res/wall.jpg");
    loadTexture(floorTexture, "res/floor.jpg");
    loadTexture(parkTexture, "images/park.jpg");
    return regl({
        frag: `
        precision mediump float;
        varying vec3 v_pos, v_relativepos, v_normal;
        uniform sampler2D wallTexture;
        uniform sampler2D floorTexture;
        uniform sampler2D parkTexture;

        void main() {
            float dist = length(v_relativepos);
            vec3 totalLight;

            // Dark ceiling with slightly smaller, crisp-edged LED-style square panels.
            if (v_normal.y < -0.5) {
                vec2 ceilingCell = mod(v_pos.xz, 6.0);
                float panelMargin = 1.15;
                float panelEnd = 6.0 - panelMargin;
                float lightPanel = step(panelMargin, ceilingCell.x)
                    * step(panelMargin, ceilingCell.y)
                    * (1.0 - step(panelEnd, ceilingCell.x))
                    * (1.0 - step(panelEnd, ceilingCell.y));
                // Warm light cream ceiling to harmonize with the golden brick wall.
                vec3 ceilingBase = vec3(0.72, 0.68, 0.59);
                vec3 panelWhite = vec3(0.98, 0.98, 0.96);
                totalLight = mix(ceilingBase, panelWhite, lightPanel);
            } else if (v_normal.y > 0.5) {
                if (v_pos.z < -0.02) {
                    // Outdoor park ground: grass on both sides of a broad, light pedestrian path.
                    vec3 grass = vec3(0.24, 0.43, 0.22);
                    float variation = 0.025 * sin(v_pos.x * 1.7 + v_pos.z * 0.9)
                        + 0.018 * sin(v_pos.x * 3.8 - v_pos.z * 1.3);
                    grass += vec3(variation, variation * 1.15, variation * 0.65);
                    float pathWidth = 2.0 + abs(v_pos.z) * 0.13;
                    float pathMask = 1.0 - smoothstep(pathWidth, pathWidth + 0.45, abs(v_pos.x - 24.0));
                    totalLight = mix(grass, vec3(0.70, 0.64, 0.51), pathMask);
                } else {
                // Keep the marble floor muted so the artwork, not the room, draws attention.
                vec3 stone = vec3(0.76, 0.73, 0.68);
                vec3 textureColor = texture2D(floorTexture, v_pos.xz / 8.0).rgb;
                totalLight = mix(stone, textureColor, 0.06);
                float pattern = sin((v_pos.x + v_pos.z * 0.65) * 2.4
                    + sin(v_pos.x * 0.7 + v_pos.z * 0.3) * 2.0);
                float vein = pow(1.0 - abs(pattern), 18.0);
                totalLight = mix(totalLight, vec3(0.55, 0.52, 0.47), vein * 0.12);
                }
            } else {
                if ((v_normal.z > 0.5 && v_pos.z < -29.9)
                    || (v_normal.x < -0.5 && v_pos.x < 0.01)
                    || (v_normal.x > 0.5 && v_pos.x > 47.99)) {
                    // Restore the reliable procedural park panorama on exterior boundary walls.
                    // The uploaded photo remains in the repo; this avoids black walls if texture loading fails.
                    float horizonCoord = abs(v_normal.x) > 0.5 ? v_pos.z : v_pos.x;
                    float skyMix = smoothstep(0.18, 0.95, v_pos.y / 13.0);
                    vec3 sky = mix(vec3(0.91, 0.96, 0.99), vec3(0.20, 0.58, 0.92), skyMix);
                    float farHill = 3.2 + 0.65 * sin(horizonCoord * 0.17) + 0.28 * sin(horizonCoord * 0.39 + 1.2);
                    float nearHill = 1.65 + 0.42 * sin(horizonCoord * 0.12 + 1.0) + 0.22 * sin(horizonCoord * 0.31);
                    vec3 hillColor = mix(vec3(0.20, 0.42, 0.25), vec3(0.34, 0.55, 0.31), smoothstep(nearHill - 0.1, nearHill + 0.1, v_pos.y));
                    hillColor = mix(vec3(0.17, 0.36, 0.24), hillColor, smoothstep(farHill - 0.1, farHill + 0.1, v_pos.y));
                    totalLight = mix(hillColor, sky, smoothstep(3.5, 4.6, v_pos.y));                } else {
                // Disable only the old park-picture panels; keep the wall geometry and wood shader active.
                bool parkWall = false;
                bool portalFrame = v_pos.z > -0.15 && v_pos.z < 0.75
                    && v_pos.x > 17.7 && v_pos.x < 30.3 && v_pos.y > 3.7;
                if (parkWall) {
                    // A framed, flat park panorama painted on each corridor wall.
                    vec2 uv = vec2((v_pos.z - 0.42) / 7.35, (v_pos.y - 0.78) / 4.78);
                    float edge = min(min(uv.x, 1.0-uv.x), min(uv.y, 1.0-uv.y));
                    if (edge < 0.035) {
                        totalLight = vec3(0.72, 0.53, 0.25);
                    } else {
                        float skyMix = smoothstep(0.42, 0.95, uv.y);
                        vec3 sky = mix(vec3(0.77, 0.84, 0.86), vec3(0.35, 0.66, 0.83), skyMix);
                        float distantHill = 0.36 + 0.055 * sin(uv.x * 10.0) + 0.025 * sin(uv.x * 23.0);
                        float nearHill = 0.23 + 0.045 * sin(uv.x * 8.0 + 1.1) + 0.025 * sin(uv.x * 18.0);
                        vec3 landscape = mix(vec3(0.20, 0.43, 0.25), vec3(0.31, 0.55, 0.30), smoothstep(nearHill-0.02, nearHill+0.02, uv.y));
                        landscape = mix(vec3(0.13, 0.34, 0.22), landscape, smoothstep(distantHill-0.025, distantHill+0.025, uv.y));
                        totalLight = mix(landscape, sky, smoothstep(distantHill, distantHill+0.025, uv.y));
                        // Repeated tree canopies and trunks give the flat landscape a park-like silhouette.
                        float treeX = fract(uv.x * 7.0);
                        float canopy = step(length(vec2(treeX - 0.5, uv.y - (0.38 + 0.025*sin(uv.x*35.0))) * vec2(2.1, 3.0)), 0.34);
                        float trunk = step(abs(treeX - 0.5), 0.035) * step(0.20, uv.y) * (1.0-step(0.34, uv.y));
                        totalLight = mix(totalLight, vec3(0.12, 0.31, 0.16), canopy * 0.72);
                        totalLight = mix(totalLight, vec3(0.31, 0.20, 0.11), trunk);
                        float path = 1.0 - smoothstep(0.02, 0.20, abs(uv.x - 0.5));
                        path *= 1.0 - smoothstep(0.15, 0.42, uv.y);
                        totalLight = mix(totalLight, vec3(0.72, 0.65, 0.49), path * 0.58);
                    }
                } else if (portalFrame) {
                    // Deep walnut portal with a restrained gold sign frame.
                    bool signFace = v_pos.x > 19.8 && v_pos.x < 28.2 && v_pos.y > 5.25 && v_pos.y < 6.28;
                    totalLight = signFace ? vec3(0.20, 0.105, 0.045) : vec3(0.31, 0.19, 0.09);
                } else {
                // Medium warm wood with layered grain, subtle pores, knots, and clear board seams.
                vec2 woodUV = vec2(v_pos.x + v_pos.z, v_pos.y);
                float boardHeight = 0.62;
                float boardRow = floor(woodUV.y / boardHeight);
                float boardPosition = fract(woodUV.y / boardHeight);
                float seamDistance = min(boardPosition, 1.0 - boardPosition);
                float boardSeam = 1.0 - smoothstep(0.006, 0.025, seamDistance);

                // Small hash-based variation breaks up the repeated, synthetic-looking stripes.
                vec2 cell = floor(vec2(woodUV.x * 2.0, woodUV.y * 5.0));
                float fineNoise = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
                float broadNoise = sin(woodUV.x * 2.1 + sin(woodUV.y * 4.7) * 0.65)
                    * 0.5 + 0.5;
                float warpedX = woodUV.x
                    + 0.045 * sin(woodUV.y * 8.0 + broadNoise * 2.0)
                    + 0.018 * sin(woodUV.y * 23.0 + woodUV.x * 0.4);

                // Several grain scales create fine fibers and wider natural growth lines.
                float grainWide = sin(warpedX * 7.5 + sin(warpedX * 1.8) * 1.4);
                float grainMedium = sin(warpedX * 21.0 + sin(woodUV.y * 2.7) * 1.1);
                float grainFine = sin(warpedX * 57.0 + sin(warpedX * 5.0) * 0.7);
                float pores = smoothstep(0.82, 1.0, sin(warpedX * 91.0 + fineNoise * 2.0));
                float grain = grainWide * 0.025 + grainMedium * 0.022
                    + grainFine * 0.009 - pores * 0.012;

                // Each board gets a restrained, slightly different walnut/oak tone.
                float boardVariation = fract(sin(boardRow * 19.19 + 7.7) * 43758.5453);
                vec3 woodBase = mix(vec3(0.40, 0.245, 0.135), vec3(0.55, 0.365, 0.215),
                    boardVariation * 0.65 + 0.17);
                float lightVariation = 0.97 + broadNoise * 0.06 + (fineNoise - 0.5) * 0.035;
                vec3 woodColor = woodBase * lightVariation
                    + vec3(grain * 1.0, grain * 0.72, grain * 0.46);

                // Very subtle elongated knot rings, varied per board segment.
                vec2 segment = vec2(floor(woodUV.x / 5.0), boardRow);
                vec2 knotCenter = vec2(
                    (fract(sin(dot(segment, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 3.2,
                    (fract(sin(dot(segment + 4.7, vec2(39.346, 11.135))) * 24634.6345) - 0.5) * 0.22
                );
                vec2 knotPos = vec2(mod(woodUV.x + 2.5, 5.0) - 2.5, boardPosition * boardHeight - boardHeight * 0.5);
                vec2 knotDelta = (knotPos - knotCenter) * vec2(0.42, 2.4);
                float knotRadius = length(knotDelta);
                float knotRings = sin(knotRadius * 38.0 + sin(knotRadius * 9.0) * 1.2);
                float knotMask = (1.0 - smoothstep(0.10, 0.34, knotRadius))
                    * (1.0 - smoothstep(0.0, 0.04, abs(knotCenter.y)));
                woodColor -= vec3(0.035, 0.024, 0.014) * knotMask * (0.5 + 0.5 * knotRings);

                vec3 seamColor = vec3(0.235, 0.145, 0.082);
                totalLight = mix(woodColor, seamColor, boardSeam);

                // Keep the wall in a natural medium-brown range without washing out the detail.
                totalLight *= 0.99 + 0.015 * smoothstep(0.1, 0.12, v_pos.y);
                }
                }
            }

            float alpha = .98 + smoothstep(150., 0., dist) - v_normal.y;
            gl_FragColor = vec4(totalLight, ${useReflexion ? "alpha" : "1.0"});
        }`,

        vert: `
        precision highp float;
        uniform mat4 proj, view;
        attribute vec3 position, normal;
        varying vec3 v_pos, v_relativepos, v_normal;
        uniform float yScale;
        void main() {
            vec3 pos = position;
            v_pos = pos;
            v_relativepos = (view * vec4(pos, 1)).xyz;
            pos.y *= yScale;
            v_normal = normal;
            gl_Position = proj * view * vec4(pos, 1);
        }`,

        attributes: {
            position: data.position,
            normal: data.normal
        },

        blend: useReflexion ? {
            enable: true,
            func: {
                src: 'src alpha',
                dst: 'one minus src alpha'
            },
        } : {},

        uniforms: {
            wallTexture,
            floorTexture,
            parkTexture
        },

        elements: new Uint32Array(data.elements)
    });
};
