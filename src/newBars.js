import * as maptalks from 'maptalks';
import * as THREE from 'three';
//import { BaseObject } from 'maptalks.three'
import { getGeometry } from './util/BarUtil';
import BaseObject from './BaseObject';
//const KEY = '-';

const OPTIONS = {
    radius: 10,
    height: 100,
    radialSegments: 6,
    altitude: 0,
    topColor: null,
    bottomColor: '#2d2f61',
};

/**
 *
 */
class newBar extends BaseObject {
    constructor(coordinate, options, color1, color2, layer) {
        options = maptalks.Util.extend({}, OPTIONS, options, { layer, coordinate });
        super();
        this._initOptions(options);
        const { height, radius, altitude } = options;
        options.height = layer.distanceToVector3(height, height).x;
        options.radius = layer.distanceToVector3(radius, radius).x;
        // Meter as unit
        options._radius = this.options.radius;
        options._height = this.options.height;
        this._h = options.height;
        const geometry = getGeometry(options);
        geometry.computeBoundingBox();

        var barmaterial = new THREE.ShaderMaterial({
            uniforms: {
                color1: {
                    value: new THREE.Color(color1)
                },
                color2: {
                    value: new THREE.Color(color2)
                },
                bboxMin: {
                    value: geometry.boundingBox.min
                },
                bboxMax: {
                    value: geometry.boundingBox.max
                }
            },
            vertexShader: `
                uniform vec3 bboxMin;
                uniform vec3 bboxMax;
                
                varying vec2 vUv;

                void main() {
                  vUv.y = (position.z - bboxMin.z) / (bboxMax.z - bboxMin.z);
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color1;
                uniform vec3 color2;
              
                varying vec2 vUv;
                
                void main() {
                  
                  gl_FragColor = vec4(mix(color1, color2, vUv.y), 1.0);
                }
            `,
            wireframe: false
        });

        //if (topColor && !material.map) {
            //initVertexColors(geometry, bottomColor, topColor, 'z', options.height / 2);
            //material.vertexColors = THREE.VertexColors;
        //}
        this._createMesh(geometry, barmaterial);
        const z = layer.distanceToVector3(altitude, altitude).x;
        const position = layer.coordinateToVector3(coordinate, z);
        this.getObject3d().position.copy(position);
        // this.getObject3d().rotation.x = Math.PI / 2;
        // this.getObject3d().translateY(options.height / 2);
    }
}

export default newBar;
