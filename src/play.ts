import { AudioPlayer } from "./audioplayer"
import { box_intersects, type Box } from "./collision"
import { Mouse } from "./mouse"
import { song_hello } from "./songs"

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


    update(dt: number) {

        if (this.hovering) {
            this.next_bounce -= dt
            if (this.next_bounce <= 0) {
                this.hovering_spring.velocity += 40 // kick it
                this.next_bounce = 600 + Math.random() * 120 // random gap till next bounce
            }
        }

        this.hovering_spring.update(dt / 1000)

    }
}

let button = new Button()


class Slot {
    constructor(readonly a_x: number) { }
}

class Card {
    hovering = false
    dragging = false
    shifting = 0
    settling = 0


    a_box = () => ({ x: this.a_x_i, y: 40, w: 48 * 4, h: 48 * 4 })

    empty_slot = -1

    constructor(public target_slot: number, public a_x_i: number) {
    }


    update(dt: number) {
        let card = this
        if (box_intersects(card.a_box(), cursor_box())) {
            card.hovering = true
        } else {
            card.hovering = false
        }

        if (mouse.is_just_down) {
            if (card.hovering) {
                card.dragging = true
            }
        }


        if (mouse.is_just_up) {
            if (card.dragging) {
                card.dragging = false
                card.settling = 100
            }
        }




        if (card.dragging) {
            let from = card.a_x_i
            let to = cursor_x - card.a_box().w / 2
            card.a_x_i = lerp(to, from, 0.3)
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
                card2.shifting = 200
            }
        }

        if (card.shifting > 0) {
            card.shifting = Math.max(0, card.shifting - dt)
            let from = slots[card.empty_slot].a_x
            let to = slots[card.target_slot].a_x

            card.a_x_i = lerp(to, from, card.shifting / 200)
        }


        if (card.settling > 0) {
            card.settling = Math.max(0, card.settling - dt)
            let from = card.a_x_i
            let to = slots[card.target_slot].a_x

            card.a_x_i = lerp(to, from, card.shifting / 100)
        }
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

    if (box_intersects(button.box, cursor_box())) {
        button.hovering = true
    } else {
        button.hovering = false
    }

    button.update(dt)

    mouse.update()

    if (mouse.is_just_down) {
        first_key_pressed = true
    }

    if (first_key_pressed && !first_audio_initialized) {
        first_audio_initialized = true
        audio.playAudio('main', true)
    }
}

let colors = [0, 1, 2, 3, 4, 5, 6, 7]

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
            cx.translate(x, y + c * 50)
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
    }

    x = 0
    y = 0
    draw_spr(0, 0, 40, 40, x, y, 4, 4)


    x = 260
    y = 236
    cx.save()
    cx.rotate(button.hovering_spring.position * -0.01)
    draw_spr(0, 80, 48, 32, x, y, 4, 4)
    cx.restore()


    x = cursor_x - 16
    y = cursor_y - 16
    draw_spr(40, 0, 16, 16, x, y, 2, 2)

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