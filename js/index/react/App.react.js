// App.react.js
'use strict'
import React from 'react';
import ClassNames from 'classnames';
import ColorAmoeba from './ColorAmoeba.react.js';
import MouseTracker from './MouseTracker.react.js';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.staticStrings = { };
        this.state = {
            startFeeding: false, amoebaHovering: false,
            points: [], pullingPoints: [],
            amoeba: {
                eatenCount: 0,
                position: {x: -1, y: -1},
                size: 80, eatingSize: 200,
                color: {red: 128, green: 128, blue: 128, alpha: 1},
            },
            mousePosition: {x: -1, y: -1},
            lastBreedTimestamp: Date.now(),
            lastUpdateTimestamp: Date.now(),
        };
        this.frequency = 60;
        this.maxPoints = 200;
        this.breedTime = 500;
        this.maxBreedTryingTime = 10;
        this.maxPullingTime = 1000;
        this.timeloop = this.timeloop.bind(this);
        this.nextStep = this.nextStep.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }
    onMouseUp() {
        let mouseState = this.refs.mouseTracker.state;
        if(mouseState.key.left !== mouseState.prev.key.left) {
            if(this.state.startFeeding) { this.setState({startFeeding: false}); }
            else if(this.state.amoebaHovering) { this.setState({startFeeding: true}); }
        }
    }
    onMouseMove() {
        let mouseState = this.refs.mouseTracker.state;
        let mouseAxis = {x: mouseState.axis.x*2, y: mouseState.axis.y*2};
        let amoeba = this.state.amoeba;
        if(this.state.startFeeding) { amoeba.position = mouseAxis; }
        let amoebaHovering = amoeba.size > Core.getDistance(amoeba.position, mouseAxis);
        this.setState({
            mousePosition: mouseState.axis,
            amoeba: amoeba, amoebaHovering: amoebaHovering,
            lastUpdateTimestamp: Date.now(),
        });
        this.nextStep();
    }
    resizePoints(points = []) {
        let now = Date.now();
        return points.map(point => {
            let age = Math.min(now - point.birthTimestamp, 1000)/1000;
            if(1 > age) { point.size = 10 + 10*Math.sin(age*Math.PI); }
            else { point.size = 10; }
            return point;
        });
    }
    huntPoints(points = []) {
        let amoeba = this.state.amoeba;
        let huntedPoints = [];
        let leftPoints = points.filter(point => {
            let distance = Core.getDistance(point.position, amoeba.position);
            if(amoeba.eatingSize >= distance) {
                point.birthTimestamp = Date.now();
                point.originPosition = point.position;
                huntedPoints.push(point);
            }
            return amoeba.eatingSize < distance;
        });
        return {freePoints: leftPoints, huntedPoints: huntedPoints};
    }
    getNewPoint() {
        let baseSize = {width: this.refs.base.clientWidth, height: this.refs.base.clientHeight};
        return {
            position: {x: baseSize.width*Math.random()*2, y: baseSize.height*Math.random()*2},
            size: 10,
            color: {
                red: Math.floor(Math.random()*255),
                green: Math.floor(Math.random()*255),
                blue: Math.floor(Math.random()*255),
                alpha: 1,
            },
            birthTimestamp: Date.now(),
        };
    }
    pullPoints(points = []) {
        let amoeba = this.state.amoeba;
        let now = Date.now();
        let maxPullingTime = this.maxPullingTime;
        return points.map(point => {
            let pullingDuration = now - point.birthTimestamp;
            let pullingRatio = 0.1*Math.sqrt(Math.min(100*pullingDuration/maxPullingTime, 100));
            point.position = {
                x: pullingRatio*amoeba.position.x + (1 - pullingRatio)*point.originPosition.x,
                y: pullingRatio*amoeba.position.y + (1 - pullingRatio)*point.originPosition.y,
            };
            return point;
        });
    }
    swalloPullingPoints(points = []) {
        let amoeba = this.state.amoeba;
        let pullingPoints = [], swalloedPoints = [];
        points.forEach(point => {
            if(Core.getDistance(amoeba.position, point.position) <= amoeba.size + point.size) {
                swalloedPoints.push(point);
            } else { pullingPoints.push(point); }
        });
        return {pullingPoints: pullingPoints, swalloedPoints: swalloedPoints};
    }
    digestSwalloedPoints(points = []) {
        let amoeba = this.state.amoeba;
        let amoebaColor = amoeba.color;
        points.forEach(point => {
            let pointColor = point.color;
            amoebaColor.red += 0.3*(pointColor.red - amoebaColor.red);
            amoebaColor.green += 0.3*(pointColor.green - amoebaColor.green);
            amoebaColor.blue += 0.3*(pointColor.blue - amoebaColor.blue);
        });
        amoeba.color = amoebaColor;
        amoeba.eatenCount += points.length;
        return amoeba;
    }
    nextStep() {
        let state = this.state;
        let now = Date.now();
        let timeStep = now - state.lastUpdateTimestamp;
        let resizedPoints = this.resizePoints(this.state.points);
        let huntingResult = this.huntPoints(resizedPoints);
        let pullingPoints = this.resizePoints(this.pullPoints(this.state.pullingPoints));
        let swallowResult = this.swalloPullingPoints(pullingPoints);
        this.digestSwalloedPoints(swallowResult.swalloedPoints);
        let points = huntingResult.freePoints;
        let lastBreedTimestamp = state.lastBreedTimestamp;
        let breedTryingTime = 0;
        if(this.maxPoints > points.length && this.breedTime < (now - lastBreedTimestamp)) {
            let amoeba = this.state.amoeba;
            let newPoint = undefined;
            while(!newPoint && this.maxBreedTryingTime > breedTryingTime) {
                newPoint = this.getNewPoint();
                // New point must outside of eating range.
                while(amoeba.eatingSize + 20 > Core.getDistance(amoeba.position, newPoint.position)) {
                    newPoint = this.getNewPoint();
                }
                // Cancel if new point too close to other points.
                let pointsPin = 0;
                while(newPoint && pointsPin < points.length) {
                    if(2*amoeba.eatingSize > Core.getDistance(newPoint.position, points[pointsPin].position)) {
                        newPoint = undefined;
                    }
                    ++pointsPin;
                }
                ++breedTryingTime;
            }
            if(newPoint) { points.push(newPoint); }
            lastBreedTimestamp = now;
        }
        this.setState({
            points: points,
            pullingPoints: swallowResult.pullingPoints.concat(huntingResult.huntedPoints),
            lastUpdateTimestamp: now,
            lastBreedTimestamp: lastBreedTimestamp,
        });
    }
    timeloop() {
        let now = Date.now();
        let maxTimeToLastUpdate = 1000/this.frequency;
        let timeToLastUpdate = now - this.state.lastUpdateTimestamp;
        if(maxTimeToLastUpdate < timeToLastUpdate) { this.nextStep(); }
    }
    componentDidMount() {
        window.setInterval(this.timeloop, 10);
        let amoeba = this.state.amoeba;
        amoeba.position = {x: this.refs.base.clientWidth, y: this.refs.base.clientHeight};
        this.setState({amoeba: amoeba});
    }
    componentWillUnmount() { }
    render() {
        let state = this.state;
        return <div
            id='wrapper' className={ClassNames({'amoeba-hovering': this.state.amoebaHovering})}
            ref='base'
        >
            <ColorAmoeba
                amoeba={this.state.amoeba}
                points={this.state.points}
                pullingPoints={this.state.pullingPoints}
            />
            <MouseTracker
                ref='mouseTracker'
                onMouseMove={this.onMouseMove}
                onMouseUp={this.onMouseUp}
            />
        </div>;
    }
}
module.exports = App;
