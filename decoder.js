const height = 21
const width = 19

const bytesPerCol =  Math.ceil( height / 8 )

const input = `$13, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $00, $F0, $1F, $00, $F0, $1F, $00, $F0, $1F, $00, $F0, $1F, $00, $F0, $1F, $00, $F0, $1F, $00, $F0, $1F, $00, $F0, $1F, $00, $F0, $1F, $00, $F0, $1F, $00, $F0, $1F,  ' Code for char L
    $13, $E0, $FF, $00, $F8, $FF, $03, $FC, $FF, $07, $FE, $FF, $0F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $E0, $1F, $7F, $C0, $1F, $3F, $80, $1F, $3F, $80, $1F, $3F, $80, $1F, $7F, $C0, $1F, $FF, $E0, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FE, $FF, $0F, $FC, $FF, $07, $F8, $FF, $03, $E0, $FF, $00,  ' Code for char O
    $13, $07, $00, $00, $3F, $00, $00, $FF, $01, $00, $FF, $0F, $00, $FF, $7F, $00, $FF, $FF, $03, $F8, $FF, $1F, $C0, $FF, $1F, $00, $FE, $1F, $00, $F0, $1F, $00, $FE, $1F, $C0, $FF, $1F, $F8, $FF, $1F, $FF, $FF, $03, $FF, $7F, $00, $FF, $0F, $00, $FF, $01, $00, $3F, $00, $00, $07, $00, $00,  ' Code for char V
    $13, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $FF, $FF, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F, $1F   ' Code for char E`


const hexChart = {
    "0":[0, 0, 0, 0],
    "1":[0, 0, 0, 1],
    "2":[0, 0, 1, 0],
    "3":[0, 0, 1, 1],
    "4":[0, 1, 0, 0],
    "5":[0, 1, 0, 1],
    "6":[0, 1, 1, 0],
    "7":[0, 1, 1, 1],
    "8":[1, 0, 0, 0],
    "9":[1, 0, 0, 1],
    "A":[1, 0, 1, 0],
    "B":[1, 0, 1, 1],
    "C":[1, 1, 0, 0],
    "D":[1, 1, 0, 1],
    "E":[1, 1, 1, 0],
    "F":[1, 1, 1, 1]
}
//] ([\$[]0-[9A-]F][{2}]

let res = `
{
	"setVars": {
		"mask": [
`

var letters = {}
var bytesets = input.split('\n')

// Convert Hex Chars to Object with 1's and 0's
bytesets.map(byteset => {
    let letter = /Code for char (.)/.exec(byteset)[1]

    let matches = [...byteset.matchAll(/\$([0-9A-F]{2})/g)]
    matches.shift()
    matches = matches.map( x => x[1])
    var bytes = new Array(width)
    for(var col = 0; col < width; col++){
        bytes[col] = matches.splice(0, bytesPerCol)
    }

    let matrix = []
    for(var i = 0; i < height; i++){
        matrix.push([])
    }

    for(var col = 0; col < width; col++){
        for(var byte = 0; byte < bytesPerCol; byte++){
            for(var nibble = 0; nibble < 2; nibble++){
                for(var b = 0; b < 4; b++){
                    let row = (byte*8) + (nibble*4) + b
                    if(row < height){
                        let char = bytes[ col ][ byte ].charAt(1 - nibble)
                        let px = hexChart[ char ][ 3 - b ]
                        matrix[row].push(px)
                    }
                }
            }
        }
    }

    letters[letter] = matrix
})

// Find distance to nearest edge
var probecounter = 0
for(letter in letters){
    let L = letters[letter]
    for(var row = 0; row < height; row++){
        let R = L[row]
        for(var col = 0; col < width; col++){
            if(letters[letter][row][col] != 0){
                let edge_found = false
                shell = 0
                while(!edge_found){
                    shell++
                    for(var side = 0; side < 4; side++){
                        let top_bot = ( ( side % 2 ) == 0 )
                        let top_right = ( side < 2 )
                        for(var i = 0; i < shell*2; i++){
                            probecounter++
                            let rowIdx = top_bot? ( top_right? row - shell              : row + shell)           : ( top_right? row - shell + i : row - shell + 1 + i)
                            let colIdx = top_bot? ( top_right? col - shell + 1 + i  : col - shell + i)   : ( top_right? col + shell         : col - shell)
                            if(L[rowIdx] == null || L[rowIdx][colIdx] == null || L[rowIdx][colIdx] == 0){
                                edge_found = true
                                letters[letter][row][col] = shell
                                break
                            }
                        }
                        if(edge_found){
                            break
                        }
                    }        
                }
            }
        }
    }
}



var serpents = {}


letterIdxs = {
    "L":0,
    "O":1 * (width-1) / 4,
    "V":2 * (width-1) / 4,
    "E":3 * (width-1) / 4
}

for(letter in letters){
    var map = []
    for (i = 0; i < (width*height); i++) {
        x = Math.floor(i / height)
        y = i % height
        y = x % 2 == 1 ? height - 1 - y : y // zigzag
        map.push([x, y, letters[letter][y][x]])
    }
    map.push([letterIdxs[letter],0,0])
    serpents[letter] = map
}



// Convert Object to linear array that snakes into matrix
// for(letter in letters){
//     var pattern = []
//     for(var col = 0; col < width; col++){
//         let inverse = (col % 2 == 0)
//         for(var row = 0; row < height; row++){
//             let rowIdx = inverse? (height - row - 1) : row
//             pattern.push(letters[letter][rowIdx][col])
//         }
//     }
//     serpent[letter] = pattern
// }

var serpJSON = JSON.stringify(serpents)


console.log(serpJSON)

var x = 0