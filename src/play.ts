import { AudioPlayer } from "./audioplayer"
import { box_intersects, type Box } from "./collision"
import { Mouse } from "./mouse"
import { song_hello, main_song, broom_song } from "./songs"


let enable_interaction = true

let walk_c = -1
let walk_c_target = -1
let walk_flash_c = 0
function update_walk(dt: number) {
    if (walk_c < walk_c_target) {
        walk_c = Math.min(walk_c_target, walk_c + 20 * dt / 1000)


    }
    if (walk_c === walk_c_target) {
        if (walk_flash_c === 0 && walk_c === 40) {
            walk_flash_c = 1000
            audio.playAudio('flash')
        }
    }

    if (walk_flash_c > 0) {
        shuffle_cards_update()
        walk_flash_c = Math.max(0, walk_flash_c - dt)
        if (walk_flash_c === 0) {
            walk_c = -1
            walk_c_target = -1
            shuffle_cards_end()
        }
    }

    if (walk_c > -1 && walk_c < 40) {
        if (walk_c % 2 > 1.8) {
            kick_camera_spring.velocity += 40
        }
    }
}


function shuffle_cards_begin() {
    enable_interaction = false
    walk_c_target = 40
}

function shuffle_cards_update() {
    if (walk_flash_c % 1 < 0.1)
        arr_shuffle(colors)
}

function shuffle_cards_end() {
    enable_interaction = true
    arr_shuffle(colors)
    cards[0].set_color(colors[0])
    cards[1].set_color(colors[1])
    cards[2].set_color(colors[2])
    arr_shuffle(colors)
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

function update_collectibles() {
    for (let apple of apples) {
        if (!apple.collected && apple.x < (button.box().x + button.box().w / 2)) {
            apple.collect()
            break
        }
    }
}

class Button {
    box = () => ({ x: 20 + level.progress * 52, y: 250, w: 160, h: 100 })

    hovering = false
    hovering_spring = new Spring(0, 0, 200, 8)

    next_bounce = 0

    flicker_spring = new Spring(0, 0, 600, 8)

    shaking = 0

    get alpha() {
        return this.flicker_spring.position < 0.01
    }

    click() {
        this.flicker_spring.velocity += 60
    }

    shake() {
        this.shaking = 600
        audio.playAudio('jump')
    }

    update(dt: number) {

        if (this.hovering) {
            this.next_bounce -= dt
            if (this.next_bounce <= 0) {
                this.hovering_spring.velocity += 40 // kick it
                this.next_bounce = 600 + Math.random() * 120 // random gap till next bounce
            }
        }

        if (this.shaking > 0) {
            this.shaking = Math.max(0, this.shaking - dt)
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
                audio.playAudio('slide')
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

class PooPickup {

    constructor(readonly x: number, readonly y: number) { }
    get box() {
        return { x: this.x, y: this.y, w: 96, h: 96 }
    }

    picked_up = false

    get anim_frame() {
        return Math.min(3, Math.floor(this.frame))
    }

    frame = 0

    broom_cool = 0

    broom_clean() {
        if (this.broom_cool === 0) {
            this.frame = this.frame + 1

            this.broom_cool = 773 + Math.random() * 120
        }

        if (this.frame === 3) {
            this.picked_up = true
        }
    }

    update(dt: number) {
        this.broom_cool = Math.max(0, this.broom_cool - dt)
    }
}

class Broom {

    frame = 0

    broom_cool = 0

    flick_spring = new Spring(0, 0, 800, 18)

    broom() {
        if (this.broom_cool === 0) {
            this.frame = (this.frame + 1) % 2
            this.broom_cool = 400

            if (this.frame === 0) {
                this.flick_spring.target = -10
            } else {
                this.flick_spring.target = 10
            }
        }
    }

    get x() {
        return this.flick_spring.position
    }


    update(dt: number) {
        this.broom_cool = Math.max(0, this.broom_cool - dt)

        this.flick_spring.update(dt / 1000)
    }
}

let thanks_time = true
let thanks_cool = 600

let broom_time = false
let broom = new Broom()
let poo_pickups = [
    new PooPickup(30, 50),
    new PooPickup(30 + 130, 50),
    new PooPickup(30 + 260, 50),
    new PooPickup(30 + 260 + 160, 50),
    new PooPickup(30, 50 + 120),
    new PooPickup(30 + 130, 30 + 120),
    new PooPickup(30 + 260, 40 + 120),
    new PooPickup(30 + 260 + 190, 60 + 120),
]

class AppleCollect {

    collected = false

    collect_spring = new Spring(0, 0, 1700, 70)

    flash_countdown = 800
    flash_timer = 0

    constructor(readonly x: number) { }

    get y() {
        return this.collect_spring.position
    }

    get flash_alpha() {
        if (this.flash_timer > 0) {
            return this.flash_timer % 400 > 200
        }
        return false
    }

    get visible() {
        if (this.collected && this.flash_timer === 0 && this.flash_countdown === 0) {
            return false
        }
        return true
    }

    collect() {
        this.collect_spring.target = -160
        this.collected = true
    }

    update(dt: number) {
        this.collect_spring.update(dt / 1000)

        if (this.collected) {
            if (this.flash_countdown > 0) {
                this.flash_countdown = Math.max(0, this.flash_countdown - dt)
                if (this.flash_countdown === 0) {
                    this.flash_timer = 1200
                }
            }

            if (this.flash_timer > 0) {
                this.flash_timer = Math.max(0, this.flash_timer - dt)
            }
        }
    }
}

let apples = [new AppleCollect(200), new AppleCollect(200 + 120), new AppleCollect(200 + 240), new AppleCollect(200 + 360)]

class Level {
    target_progress = 0
    progress = 0

    level_up() {
        this.target_progress += 1
    }

    update(dt: number) {
        if (this.progress < this.target_progress) {
            this.progress = lerp(this.progress, this.target_progress, dt / 1000)
            this.progress -= Math.sin(t * 0.01) * 0.01
        }
    }
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}

let level = new Level()

let kick_camera_spring = new Spring(0, 0, 1800, 8)

let a_x = 16 + 0
let b_x = 16 * 2 + 48 * 4
let c_x = 16 * 3 + 48 * 8

let slots = [new Slot(a_x), new Slot(b_x), new Slot(c_x)]
let cards = [new Card(0, a_x), new Card(1, b_x), new Card(2, c_x)]

let cursor_x = 0
let cursor_y = 0
let cursor_box = () => ({ x: cursor_x - 16, y: cursor_y - 16, w: 32, h: 32 })
let cursor_box_large = () => ({ x: cursor_x - 16, y: cursor_y - 16, w: 64, h: 64 })
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

        if (box_intersects(button.box(), cursor_box())) {
            button.hovering = true
        } else {
            button.hovering = false
        }

        let has_sorted_true = true
        {
            let sorted_cards = cards.slice(0).sort((a, b) => a.a_x_i - b.a_x_i)
            if (new Set(cards.map(_ => _.a_c)).size !== 3) {
                has_sorted_true = true
            } else if (
                colors.filter(_ => cards.find(c => c.a_c === _)).join('') !== sorted_cards.map(_ => _.a_c).join('')) {
                has_sorted_true = false
            }
        }

        if (broom_time) {
            for (let poo of poo_pickups) {
                if (box_intersects(poo.box, cursor_box_large())) {
                    broom.broom()
                    poo.broom_clean()
                }
            }
        }

        for (let poo of poo_pickups) {
            poo.update(dt)
        }
        broom.update(dt)

        if (thanks_time) {
            thanks_cool = thanks_cool - dt
            if (thanks_cool < 0) {
                update_thanks_time(dt)
            }
        } else if (broom_time) {
            let all_clean = poo_pickups.every(_ => _.picked_up)
            if (all_clean) {
                thanks_time = true
                broom_time = false
            }
        } else {
            let all_eaten = apples.every(_ => !_.visible)
            if (all_eaten) {
                broom_time = true
                audio.stopAudio('main')
                audio.playAudio('broom', true)
            }
        }

        if (mouse.is_just_down) {
            if (button.hovering) {
                //has_sorted_true = true
                if (has_sorted_true) {
                    button.click()
                    level.level_up()
                    shuffle_cards_begin()
                    audio.playAudio('shuffle')
                } else {
                    button.shake()
                }
            }
        }


        if (mouse.is_just_down) {
            for (let card of cards)
                if (card.hovering) {
                    card.dragging = true
                    audio.playAudio('begin_drag')
                    break
                }
        }
    }


    if (mouse.is_just_up) {
        for (let card of cards)
            if (card.dragging) {
                card.dragging = false
                audio.playAudio('end_drag')

                let to = slots[card.target_slot].a_x
                card.shifting.target = to
            }
    }

    update_collectibles()
    for (let apple of apples) {
        apple.update(dt)
    }


    update_walk(dt)

    button.update(dt)

    kick_camera_spring.update(dt / 1000)
    level.update(dt)

    if (mouse.is_just_down) {
        first_key_pressed = true
    }

    if (first_key_pressed && !first_audio_initialized) {
        first_audio_initialized = true
        audio.playAudio('main', true)
    }

    mouse.update()
    audio.update(dt)
}

let colors = [0, 1, 2, 3, 4, 5, 6]

export function _render() {
    if (!first_update_called) return

    let sy = vheight / 360
    let sx = sy
    cx.setTransform(sx, 0, 0, sy, 0, 0)

    cx.fillStyle = 'black'
    cx.fillRect(0, 0, 640, 360)

    if (thanks_time && thanks_cool < 0) {
        render_thanks_time()
        return
    }


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


    if (broom_time) {
        for (let poo of poo_pickups) {
            x = poo.box.x
            y = poo.box.y
            draw_spr(72 + 24 * Math.floor(poo.frame), 0, 24, 24, x, y, 4, 4)
        }
    }

    if (!broom_time) {

        for (let card of cards) {
            y = 40
            x = card.a_x_i

            let shake_t = kick_camera_spring.position
            cx.save()
            cx.translate(x, y)
            cx.translate(96, 96)
            cx.rotate(shake_t * 0.1 * (card.a_c < 3.5 ? -1 : 1))
            cx.translate(0, shake_t * -10)
            cx.translate(-96, -96)
            draw_spr(0, 112, 48, 48, 0, 0, 4, 4)
            cx.restore()

            let c = card.a_c
            let sy = Math.floor(c / 2)
            let sx = c % 2
            cx.save()
            cx.translate(x + 50, y + 50)

            for (let r = 0; r < 4; r++) {
                cx.translate(8 * 12 / 2, 8 * 12 / 2)
                cx.rotate(shake_t * Math.PI * 0.1)
                cx.rotate(Math.PI * 0.25 * r / 4)
                cx.translate(-8 * 12 / 2, -8 * 12 / 2)
                draw_spr(56 + sx * 8, sy * 8, 8, 8, 0, 0, 12, 12)
            }
            cx.restore()
        }
    }

    let collect_y = 0
    x = apples[0].x
    y = 250
    let a = Math.sin(t * 0.01 + x)
    collect_y = apples[0].y
    cx.globalAlpha = apples[0].flash_alpha ? 0.3 : 1
    if (apples[0].visible) {
        if (collect_y < 0) a *= 0.3
        draw_spr(40, 40, 40, 40, x, y + a * 12 + 18 + collect_y, 2, 2)
    }
    x = apples[1].x
    a = Math.sin(t * 0.01 + x)
    collect_y = apples[1].y
    cx.globalAlpha = apples[1].flash_alpha ? 0.3 : 1
    if (collect_y < 0) a *= 0.3
    if (apples[1].visible) {
        draw_spr(0, 40, 40, 40, x, y + a * 10 + 8 + collect_y, 2.2, 2.3)
    }
    x = apples[2].x
    a = Math.sin(t * 0.01 + x)
    collect_y = apples[2].y
    cx.globalAlpha = apples[2].flash_alpha ? 0.3 : 1
    if (collect_y < 0) a *= 0.3
    if (apples[2].visible) {
        draw_spr(0, 40, 40, 40, x, y + a * 8 + 8 + collect_y, 2.3, 2.3)
    }
    x = apples[3].x
    a = Math.sin(t * 0.01 + x)
    collect_y = apples[3].y
    cx.globalAlpha = apples[3].flash_alpha ? 0.3 : 1
    if (collect_y < 0) a *= 0.3
    if (apples[3].visible) {
        draw_spr(80, 40, 40, 40, x - 10, y + a * 4 - 4 + collect_y, 2.5, 2.5)
    }

    cx.globalAlpha = 1

    x = 0 + button.box().x - 16
    y = 236
    cx.save()
    if (button.shaking === 0) {
        cx.rotate(button.hovering_spring.position * -0.01)
    }
    if (!button.alpha) {
        cx.globalAlpha = 0.1345
    }
    if (button.shaking) {
        let t = button.shaking / 300
        x += Math.sin(t * 9) * 10
    }
    draw_spr(112, 128, 48, 32, x, y, 4, 4)
    cx.restore()

    x = cursor_x - 16
    y = cursor_y - 16

    if (broom_time) {
        x -= 30
        y -= 90
        x += broom.x
        y += Math.sin(broom.x * 0.2) * 3
        let flip = broom.frame * 32
        draw_spr(48 + flip, 112, 32, 48, x, y, 3, 3)
    } else {
        draw_spr(40, 0, 16, 16, x, y, 2, 2)
    }

    let c = walk_c
    for (let k = 0; k < 8; k++) {
        if (k > c / 4) break
        let j = Math.floor(k / 2)
        let i = k % 2
        cx.save()
        cx.translate(j * 200 + i * 130, 60 + i * 130 + Math.sin(j * 0.01) * 30)
        cx.rotate(-Math.PI * 0.5)
        cx.translate(-60, -60)
        if (walk_flash_c % 400 > 200) {
            cx.globalAlpha = 0.3
        }
        draw_spr(0, 0, 40, 40, 0, 0, 3, 3)
        cx.restore()
    }

    if (import.meta.env.DEV) {
        //render_box(cursor_box_large())
        //render_box(button.box())
        //for (let poo of poo_pickups) {
        //render_box(poo.box)
        //}
    }
}

function draw_spr(sx: number, sy: number, sw: number, sh: number, x: number, y: number, scale_x: number, scale_y: number) {

    const inset = 0.5;
    cx.drawImage(spr_png, sx + inset, sy + inset, sw - inset * 2, sh - inset * 2, x, y, sw * scale_x, sh * scale_y);
    //cx.drawImage(spr_png, sx, sy, sw, sh, x, y, Math.floor(sw * scale_x), Math.floor(sh * scale_y))
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

type AudioPlayback = { stop: () => void, setVolume: (_: number) => void }

class AudioPlayerManager {
    static loadAudio = async () => {
        let res = new AudioPlayerManager()

        res.audio.set('broom', await AudioPlayer.init(broom_song, 110))
        res.audio.set('main', await AudioPlayer.init(main_song, 110))
        res.audio.set('jump', await AudioPlayer.init(song_hello.slice(23, 35), 333))
        res.audio.set('end_drag', await AudioPlayer.init(song_hello.slice(6, 7), 330))
        res.audio.set('begin_drag', await AudioPlayer.init(song_hello.slice(17, 18), 330))
        res.audio.set('slide', await AudioPlayer.init(song_hello.slice(37, 40), 320))

        res.audio.set('flash', await AudioPlayer.init(song_hello.slice(8, 13).repeat(2).concat(song_hello.slice(5, 8).repeat(3)).concat(song_hello.slice(0, 5).repeat(2)), 301))
        res.audio.set('shuffle', await AudioPlayer.init(song_hello.slice(8, 13).repeat(7), 331))
        return res
    }

    audio: Map<string, AudioPlayer> = new Map()

    looping: Map<string, AudioPlayback> = new Map()

    stopAudio(name: string) {
        this.looping.get(name)?.stop()
    }

    playAudio(name: string, loop: boolean = false) {
        let pl = this.audio.get(name)!.play(loop)
        if (loop) {
            this.looping.set(name, pl)
        } else {
            pl.setVolume(0.5)
        }

        if (!loop) {
            this.quiet_cool = 200
        }
    }

    set_looping_quiet_down() {
        for (let pl of this.looping.values()) {
            pl.setVolume(0.3)
        }
    }

    set_looping_quiet_up() {
        for (let pl of this.looping.values()) {
            pl.setVolume(0.8)
        }
    }

    is_quiet = false
    quiet_cool = 0
    change_cool = 0
    update(dt: number) {

        if (this.quiet_cool > 0 && !this.is_quiet) {
            if (this.change_cool === 0) {
                this.is_quiet = true
                this.set_looping_quiet_down()
                this.change_cool = 300
            }
        }

        if (this.quiet_cool === 0 && this.is_quiet) {
            if (this.change_cool === 0) {
                this.is_quiet = false
                this.set_looping_quiet_up()
                this.change_cool = 300
            }
        }

        this.quiet_cool = Math.max(0, this.quiet_cool - dt)
        this.change_cool = Math.max(0, this.change_cool - dt)
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

class ThanksHorse {

    x = 0
    y = 0

    get anim_frame() {
        return Math.floor(this.frame % 3)
    }
    frame = 0

    update(dt: number) {
        this.frame += 0.007 * dt


    }
}
let thanks_horse = new ThanksHorse()


function render_thanks_time() {
    let x = 120
    let y = 120
    draw_spr(0 + thanks_horse.anim_frame * 48, 80, 48, 32, x, y, 6, 6)
}

function update_thanks_time(dt: number) {
    thanks_horse.update(dt)

}