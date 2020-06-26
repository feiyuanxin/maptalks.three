import * as maptalks from 'maptalks';
import * as THREE from 'three';
import BaseObject from './BaseObject';
import { getGeometry, initVertexColors, mergeBarGeometry } from './util/BarUtil';
import Bar from './Bar';
import MergedMixin from './MergedMixin';
import { addAttribute } from './util/ThreeAdaptUtil';


const OPTIONS = {
    coordinate: null,
    radius: 10,
    height: 100,
    radialSegments: 6,
    altitude: 0,
    topColor: null,
    bottomColor: '#2d2f61',
};

/**
 * merged bars
 */
class Bars extends MergedMixin(BaseObject) {
    constructor(points, options, material, layer) {
        if (!Array.isArray(points)) {
            points = [points];
        }
        const len = points.length;
        const geometries = [], bars = [], geometriesAttributes = [], faceMap = [];
        let faceIndex = 0, psIndex = 0, normalIndex = 0, uvIndex = 0;
        for (let i = 0; i < len; i++) {
            const opts = maptalks.Util.extend({ index: i }, OPTIONS, points[i]);
            const { radius, radialSegments, altitude, topColor, bottomColor, height, coordinate } = opts;
            const r = layer.distanceToVector3(radius, radius).x;
            const h = layer.distanceToVector3(height, height).x;
            const alt = layer.distanceToVector3(altitude, altitude).x;
            const buffGeom = getGeometry({ radius: r, height: h, radialSegments }, false);
            if (topColor && !material.map) {
                initVertexColors(buffGeom, bottomColor, topColor, 'z', h / 2);
                material.vertexColors = THREE.VertexColors;
            }
            // buffGeom.rotateX(Math.PI / 2);
            const v = layer.coordinateToVector3(coordinate);
            const parray = buffGeom.attributes.position.array;
            for (let j = 0, len1 = parray.length; j < len1; j += 3) {
                parray[j + 2] += alt;
                parray[j] += v.x;
                parray[j + 1] += v.y;
                parray[j + 2] += v.z;
            }
            geometries.push(buffGeom);
            const bar = new Bar(coordinate, opts, material, layer);
            bars.push(bar);

            const faceLen = buffGeom.index.count / 3;
            faceMap[i] = [faceIndex + 1, faceIndex + faceLen];
            faceIndex += faceLen;

            const psCount = buffGeom.attributes.position.count,
                //  colorCount = buffGeom.attributes.color.count,
                normalCount = buffGeom.attributes.normal.count, uvCount = buffGeom.attributes.uv.count;
            geometriesAttributes[i] = {
                position: {
                    count: psCount,
                    start: psIndex,
                    end: psIndex + psCount * 3,
                },
                normal: {
                    count: normalCount,
                    start: normalIndex,
                    end: normalIndex + normalCount * 3,
                },
                // color: {
                //     count: colorCount,
                //     start: colorIndex,
                //     end: colorIndex + colorCount * 3,
                // },
                uv: {
                    count: uvCount,
                    start: uvIndex,
                    end: uvIndex + uvCount * 2,
                },
                hide: false
            };
            psIndex += psCount * 3;
            normalIndex += normalCount * 3;
            // colorIndex += colorCount * 3;
            uvIndex += uvCount * 2;
        }
        super();
        options = maptalks.Util.extend({}, { altitude: 0, layer, points }, options);
        this._initOptions(options);
        const geometry = mergeBarGeometry(geometries);
        this._createMesh(geometry, material);

        this._faceMap = faceMap;
        this._baseObjects = bars;
        this._datas = points;
        this._geometriesAttributes = geometriesAttributes;
        this.faceIndex = null;
        this._geometryCache = geometry.clone();
        this.isHide = false;
        this._colorMap = {};
        this._initBaseObjectsEvent(bars);
        this._setPickObject3d();
        this._init();
    }


    // eslint-disable-next-line consistent-return
    getSelectMesh() {
        const index = this._getIndex();
        if (index != null) {
            return {
                data: this._datas[index],
                baseObject: this._baseObjects[index]
            };
        }
    }

    // eslint-disable-next-line consistent-return
    _getIndex(faceIndex) {
        if (faceIndex == null) {
            faceIndex = this.faceIndex || this.index;
        }
        return faceIndex;
    }

    _init() {
        const pick = this.getLayer().getPick();
        this.on('add', () => {
            pick.add(this.pickObject3d);
        });
        this.on('remove', () => {
            pick.remove(this.pickObject3d);
        });
    }

    _setPickObject3d() {
        const geometry = this.getObject3d().geometry.clone();
        const pick = this.getLayer().getPick();
        const { _geometriesAttributes } = this;
        const colors = [];
        for (let i = 0, len = _geometriesAttributes.length; i < len; i++) {
            const color = pick.getColor();
            const colorIndex = color.getHex();
            this._colorMap[colorIndex] = i;
            const { count } = _geometriesAttributes[i].position;
            this._datas[i].colorIndex = colorIndex;
            for (let j = 0; j < count; j++) {
                colors.push(color.r, color.g, color.b);
            }
        }
        addAttribute(geometry, 'color', new THREE.Float32BufferAttribute(colors, 3, true));
        const material = new THREE.MeshBasicMaterial();
        material.vertexColors = THREE.VertexColors;
        const color = pick.getColor();
        const colorIndex = color.getHex();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(this.getObject3d().position);
        mesh._colorIndex = colorIndex;
        this.setPickObject3d(mesh);
    }

    // eslint-disable-next-line no-unused-vars
    identify(coordinate) {
        return this.picked;
    }
}

export default Bars;
