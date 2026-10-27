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
    loadTexture(wallTexture, "images/%D8%AF%DB%8C%D9%88%D8%A7%D8%B1%20%DA%86%D9%88%D8%A8%DB%8C.png");
    loadTexture(floorTexture, "res/floor.jpg");
    return regl({
        frag: `
        precision mediump float;
        varying vec3 v_pos, v_relativepos, v_normal;
        uniform sampler2D wallTexture;
        uniform sampler2D floorTexture;

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
                if (v_normal.z > 0.5 && v_pos.z < -29.9) {
                    // Daylight sky and rolling green horizon; no tree models are needed.
                    float skyMix = smoothstep(0.18, 0.95, v_pos.y / 13.0);
                    // Brighter clear daytime sky, with a pale horizon and vivid blue overhead.
                    vec3 sky = mix(vec3(0.91, 0.96, 0.99), vec3(0.20, 0.58, 0.92), skyMix);
                    float farHill = 3.2 + 0.65 * sin(v_pos.x * 0.17) + 0.28 * sin(v_pos.x * 0.39 + 1.2);
                    float nearHill = 1.65 + 0.42 * sin(v_pos.x * 0.12 + 1.0) + 0.22 * sin(v_pos.x * 0.31);
                    vec3 hillColor = mix(vec3(0.20, 0.42, 0.25), vec3(0.34, 0.55, 0.31), smoothstep(nearHill - 0.1, nearHill + 0.1, v_pos.y));
                    hillColor = mix(vec3(0.17, 0.36, 0.24), hillColor, smoothstep(farHill - 0.1, farHill + 0.1, v_pos.y));
                    totalLight = mix(hillColor, sky, smoothstep(3.5, 4.6, v_pos.y));
                } else {
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
                // Use the uploaded wood-wall image as a repeating texture on every interior wall.
                // The world-space coordinates keep the grain running along each wall and repeat
                // the image horizontally and vertically rather than stretching it over the whole room.
                vec2 wallUV = vec2((v_pos.x + v_pos.z) / 3.0, v_pos.y / 2.0);
                totalLight = texture2D(wallTexture, wallUV).rgb;

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
            floorTexture
        },

        elements: new Uint32Array(data.elements)
    });
};
