import { AudioPlayer } from "./audioplayer"
import { box_intersects, type Box } from "./collision"
import { Mouse } from "./mouse"
import { song_hello } from "./songs"

let enable_interaction = true

let walk_c = -1
let walk_c_target = -1
let walk_flash_c = 0
function update_walk(dt: number) {
    if (walk_c < walk_c_target) {
        walk_c = Math.min(walk_c_target, walk_c + 20 * dt / 1000)
    }

    if (walk_c === walk_c_target) {
        if (walk_flash_c === 0 && walk_c === 10) {
            walk_flash_c = 600
        }
    }

    if (walk_flash_c > 0) {
        walk_flash_c = Math.max(0, walk_flash_c - dt)
        if (walk_flash_c === 0) {
            walk_c = -1
            walk_c_target = -1
            enable_interaction = true
        }
    }
}


function shuffle_cards() {
    enable_interaction = false
    arr_shuffle(colors)
    cards[0].set_color(colors[0])
    cards[1].set_color(colors[1])
    cards[2].set_color(colors[2])
    arr_shuffle(colors)

    walk_c_target = 10
}

class Spring {
    position: number;
    velocity = 0;
    target: number;
    stiffness: number;
    damping: number;

    constructor(position: number, target = position, stiffness = 170, damping = 26) {
        this.position = position;
        this.target = target;
        this.stiffness = stiffness;
        this.damping = damping;
    }

    update(dt: number) {
        const force = (this.target - this.position) * this.stiffness - this.velocity * this.damping;
        this.velocity += force * dt;
        this.position += this.velocity * dt;
    }
}

class Button {
    box = { x: 274, y: 250, w: 160, h: 100 }

    hovering = false
    hovering_spring = new Spring(0, 0, 200, 8)

    next_bounce = 0

    flicker_spring = new Spring(0, 0, 600, 8)

    get alpha() {
        return this.flicker_spring.position < 0.01
    }

    click() {
        this.flicker_spring.velocity += 60
    }

    update(dt: number) {

        if (this.hovering) {
            this.next_bounce -= dt
            if (this.next_bounce <= 0) {
                this.hovering_spring.velocity += 40 // kick it
                this.next_bounce = 600 + Math.random() * 120 // random gap till next bounce
            }
        }

        this.hovering_spring.update(dt / 1000)
        this.flicker_spring.update(dt / 1000)


    }
}

let button = new Button()


class Slot {
    constructor(readonly a_x: number) { }
}

class Card {
    hovering = false
    dragging = false
    shifting: Spring
    color: Spring

    get a_c() {
        return this.color.position
    }

    get a_x_i() {
        return this.shifting.position
    }

    set_color(color: number) {
        this.color.target = color
    }

    a_box = () => ({ x: this.a_x_i, y: 40, w: 48 * 4, h: 48 * 4 })

    empty_slot = -1

    constructor(public target_slot: number, public x: number) {
        this.shifting = new Spring(x, x, 800, 20)
        this.color = new Spring(0, 0)
    }


    update(dt: number) {
        let card = this
        if (box_intersects(card.a_box(), cursor_box())) {
            card.hovering = true
        } else {
            card.hovering = false
        }


        if (card.dragging) {
            let from = card.a_x_i
            let to = cursor_x - card.a_box().w / 2
            card.shifting.position = lerp(to, from, 0.3)
            card.shifting.target = card.shifting.position
        }

        if (card.dragging) {
            for (let slot of slots) {
                if (Math.abs(slot.a_x - card.a_x_i) < Math.abs(slots[card.target_slot].a_x - card.a_x_i)) {
                    card.empty_slot = card.target_slot
                    card.target_slot = slots.indexOf(slot)
                }
            }
        }

        for (let card2 of cards) {
            if (card === card2) continue
            if (card.target_slot === card2.target_slot) {
                card2.empty_slot = card2.target_slot
                card2.target_slot = card.empty_slot

                let to = slots[card2.target_slot].a_x
                card2.shifting.target = to
            }
        }

        let epsilon = 0.1
        if (Math.abs(card.color.position - card.color.target) < epsilon) {
            card.color.position = card.color.target
            card.color.velocity = 0
        }

        card.shifting.update(dt / 1000)

        card.color.update(dt / 1000)
    }
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}

let a_x = 16 + 0
let b_x = 16 * 2 + 48 * 4
let c_x = 16 * 3 + 48 * 8

let slots = [new Slot(a_x), new Slot(b_x), new Slot(c_x)]
let cards = [new Card(0, a_x), new Card(1, b_x), new Card(2, c_x)]

let cursor_x = 0
let cursor_y = 0
let cursor_box = () => ({ x: cursor_x - 16, y: cursor_y - 16, w: 32, h: 32 })
let audio: AudioPlayerManager

export function _init() {
}

let t = 0
let first_update_called = false
let first_key_pressed = false
let first_audio_initialized = false
export function _update(dt: number) {
    t += dt;

    first_update_called = true

    cursor_x = mouse.is_hovering.x
    cursor_y = mouse.is_hovering.y

    for (let card of cards) {
        card.update(dt)
    }

    cards.sort((a, b) => a.dragging ? 1 : b.dragging ? -1 : 0)

    if (enable_interaction) {

        if (box_intersects(button.box, cursor_box())) {
            button.hovering = true
        } else {
            button.hovering = false
        }

        if (mouse.is_just_down) {
            if (button.hovering) {
                button.click()
                //arr_shuffle(colors)
                shuffle_cards()
            }
        }


        if (mouse.is_just_down) {
            for (let card of cards)
                if (card.hovering) {
                    card.dragging = true
                    break
                }
        }
    }


    if (mouse.is_just_up) {
        for (let card of cards)
            if (card.dragging) {
                card.dragging = false

                let to = slots[card.target_slot].a_x
                card.shifting.target = to
            }
    }




    update_walk(dt)

    button.update(dt)


    if (mouse.is_just_down) {
        first_key_pressed = true
    }

    if (first_key_pressed && !first_audio_initialized) {
        first_audio_initialized = true
        audio.playAudio('main', true)
    }

    mouse.update()
}

let colors = [0, 1, 2, 3, 4, 5, 6]

export function _render() {
    if (!first_update_called) return

    let sy = vheight / 360
    let sx = sy
    cx.setTransform(sx, 0, 0, sy, 0, 0)

    cx.fillStyle = 'black'
    cx.fillRect(0, 0, 640, 360)


    for (let ic = 0; ic < 7; ic++) {
        let c = colors[ic]
        for (let i = 0; i < 80; i++) {
            const angle = Math.PI * 0.1 + (i / 80) * Math.PI * 2
            const rx = 300, ry = 280          // even horizontal/vertical radius
            const x = 320 + Math.cos(angle) * rx
            const y = 300 + Math.sin(angle) * ry

            let sy = Math.floor(c / 2)
            let sx = c % 2
            cx.save()
            cx.translate(x, y + ic * 50)
            cx.rotate(angle)
            draw_spr(56 + sx * 8, sy * 8, 8, 8, 0, 0, 7, 7)
            cx.restore()
        }
    }




    let x = 0, y = 0


    for (let card of cards) {
        y = 40
        x = card.a_x_i
        draw_spr(0, 112, 48, 48, x, y, 4, 4)


        let c = card.a_c
        let sy = Math.floor(c / 2)
        let sx = c % 2
        cx.save()
        cx.translate(x + 50, y + 50)

        for (let r = 0; r < 4; r++) {
            cx.translate(8 * 12 / 2, 8 * 12 / 2)
            cx.rotate(Math.PI * 0.25 * r / 4)
            cx.translate(-8 * 12 / 2, -8 * 12 / 2)
            draw_spr(56 + sx * 8, sy * 8, 8, 8, 0, 0, 12, 12)
        }

        cx.restore()
    }

    x = 0
    y = 0
    //draw_spr(0, 0, 40, 40, x, y, 4, 4)


    x = 260
    y = 236
    cx.save()
    cx.rotate(button.hovering_spring.position * -0.01)
    if (!button.alpha) {
        cx.globalAlpha = 0.1345
    }
    draw_spr(0, 80, 48, 32, x, y, 4, 4)
    cx.restore()


    x = cursor_x - 16
    y = cursor_y - 16
    draw_spr(40, 0, 16, 16, x, y, 2, 2)

    let c = walk_c
    for (let k = 0; k < 8; k++) {
        if (k > c) break
        let j = Math.floor(k / 2)
        let i = k % 2
        cx.save()
        cx.translate(j * 200 + i * 130, 60 + i * 130 + Math.sin(j * 0.01) * 30)
        cx.rotate(-Math.PI * 0.5)
        cx.translate(-60, -60)
        if (walk_flash_c % 200 > 80) {
            cx.globalAlpha = 0.3
        }
        draw_spr(0, 0, 40, 40, 0, 0, 3, 3)
        cx.restore()
    }

    if (import.meta.env.DEV) {
        //render_box(cursor_box())
        //render_box(button.box)
    }
}

function draw_spr(sx: number, sy: number, sw: number, sh: number, x: number, y: number, scale_x: number, scale_y: number) {
    cx.drawImage(spr_png, sx, sy, sw, sh, x, y, sw * scale_x, sh * scale_y)
}

let spr_png!: HTMLImageElement
export async function _load() {


    audio = await AudioPlayerManager.loadAudio()

    spr_png = new Image()
    spr_png.src = './sprites.png'
    return Promise.all([
        new Promise(resolve => spr_png.onload = resolve),
    ])
}

let cx: CanvasRenderingContext2D
export function _set_ctx(ctx: CanvasRenderingContext2D) {
    cx = ctx
}

//@ts-ignore
let vwidth = 0
let vheight = 0
export function _set_viewport(top: number, left: number, width: number, height: number, clientWidth: number, clientHeight: number) {
    vwidth = width
    vheight = height
    mouse.set_bounds(top, left, clientWidth, clientHeight, 640, 360)
}


let mouse: Mouse
export function _set_canvas(canvas: HTMLCanvasElement) {
    mouse = Mouse.bindTo(canvas)
}

// @ts-ignore
function render_box(box: Box, color = 'white') {
    cx.lineWidth = 1
    cx.strokeStyle = color
    cx.strokeRect(box.x, box.y, box.w, box.h)
}

class AudioPlayerManager {
    static loadAudio = async () => {
        let res = new AudioPlayerManager()

        res.audio.set('main', await AudioPlayer.init(song_hello))
        res.audio.set('jump', await AudioPlayer.init(song_hello.slice(10, 13), 300))

        return res
    }

    audio: Map<string, AudioPlayer> = new Map()

    playAudio(name: string, loop: boolean = false) {
        this.audio.get(name)!.play(loop)
    }
}


export function arr_shuffle<A>(array: Array<A>) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {

        // Pick a remaining element...
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array
}

